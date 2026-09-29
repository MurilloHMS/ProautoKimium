import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import {
  EmployeeDocumentService,
  toIsoDate,
} from '../../../../infrastructure/services/hr/employee-document.service';
import {
  DOCUMENT_STATUS_INFO,
  DOCUMENT_STATUS_ORDER,
  EmployeeDocument,
  EmployeeDocumentStatus,
  EmployeeDocumentType,
  describeDue,
} from '../../../../domain/models/hr/employee-document.model';
import { formatStampBr, parseDateOnly } from '../../../../domain/utils/date-only';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import { LinkDocumentComponent, LinkPreset } from './link-document/link-document.component';
import { DocumentTypesComponent } from './document-types/document-types.component';

/**
 * Documentos dos funcionários — a tela do RH (rota `rh/employee-documents`).
 *
 * Lista plana com chips de situação, como a toolbar da Programação (decisão
 * dele, 2026-09-29): a pergunta de todo dia é "o que vence este mês", e ela se
 * responde com um toque em "Vence em breve".
 *
 * **A lista vem inteira da API e os filtros são daqui.** O número de cada chip
 * é do quadro todo — ele não pode encolher porque outro filtro foi ligado.
 */
@Component({
  selector: 'app-employee-documents-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, Toast, Tooltip, DatePickerModule, InputTextModule, PkButtonComponent,
    PkDialogComponent, PkSheetComponent, PkTableComponent, PkComboboxComponent, PkCanDirective,
    LinkDocumentComponent, DocumentTypesComponent],
  templateUrl: './employee-documents-manager.component.html',
  styleUrl: './employee-documents-manager.component.scss',
  providers: [MessageService],
})
export class EmployeeDocumentsManagerComponent implements OnInit {

  private readonly service = inject(EmployeeDocumentService);
  private readonly employeeStore = inject(EmployeeStore);
  private readonly messages = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly ehCelular = ehCelular();
  readonly statusOrder = DOCUMENT_STATUS_ORDER;
  readonly statusInfo = DOCUMENT_STATUS_INFO;
  readonly describeDue = describeDue;

  readonly documents = signal<EmployeeDocument[]>([]);
  readonly types = signal<EmployeeDocumentType[]>([]);
  readonly loading = signal(false);

  // ─── Filtros ──────────────────────────────────────────────────────────────
  readonly statusFilter = signal<ReadonlySet<EmployeeDocumentStatus>>(new Set());
  readonly employeeFilter = signal<string | null>(null);
  readonly typeFilter = signal<string | null>(null);
  readonly search = signal('');
  /** Celular: funcionário e tipo numa folha, atrás do ícone de filtro. */
  readonly filtersOpen = signal(false);

  readonly employeeOptions = this.employeeStore.options;
  readonly typeOptions = computed(() => this.types().map(type => ({ label: type.name, value: type.id })));

  readonly hasFilters = computed(() =>
    this.statusFilter().size > 0 || !!this.employeeFilter() || !!this.typeFilter() || !!this.search().trim());

  /** Quantos em cada situação, no quadro inteiro. */
  readonly counts = computed(() => {
    const counts = new Map<EmployeeDocumentStatus, number>();
    for (const document of this.documents()) {
      counts.set(document.status, (counts.get(document.status) ?? 0) + 1);
    }
    return counts;
  });

  /**
   * As linhas, filtradas e em ordem de prazo.
   *
   * **Substituídos ficam fora até o chip deles ser ligado**: um ASO velho que
   * já tem um novo no lugar é história, não trabalho.
   *
   * Ordem: o vencimento mais próximo primeiro (os vencidos, com data no
   * passado, sobem sozinhos); sem data no fim; empate pelo mais recente.
   */
  readonly rows = computed(() => {
    const statuses = this.statusFilter();
    const employee = this.employeeFilter();
    const type = this.typeFilter();
    const term = normalize(this.search());

    return this.documents()
      .filter(document => statuses.size ? statuses.has(document.status) : document.status !== 'REPLACED')
      .filter(document => !employee || document.employeeId === employee)
      .filter(document => !type || document.typeId === type)
      .filter(document => !term || normalize(
        `${document.employeeName} ${document.title} ${document.typeName ?? ''} ${document.originalFilename}`).includes(term))
      .sort((a, b) => {
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return b.uploadedAt.localeCompare(a.uploadedAt);
      });
  });

  // ─── Janelas ──────────────────────────────────────────────────────────────
  readonly linkOpen = signal(false);
  readonly linkPreset = signal<LinkPreset | null>(null);
  readonly typesOpen = signal(false);

  readonly editTarget = signal<EmployeeDocument | null>(null);
  readonly editTitle = signal('');
  readonly editTypeId = signal<string | null>(null);
  readonly editDue = signal<Date | null>(null);
  readonly editSaving = signal(false);

  readonly deleteTarget = signal<EmployeeDocument | null>(null);
  readonly deleting = signal(false);

  readonly downloadingId = signal<string | null>(null);

  ngOnInit(): void {
    this.employeeStore.load();
    this.load();
    this.loadTypes();

    // O aviso de vencimento chega com `?status=EXPIRING` no link: a tela abre
    // já no recorte que o aviso anunciou. Observable, e não snapshot: um
    // segundo link com a tela aberta também precisa valer.
    const subscription = this.route.queryParamMap.subscribe(params => this.applyUrl(params));
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  private applyUrl(params: ParamMap): void {
    const status = params.get('status')?.toUpperCase() as EmployeeDocumentStatus | undefined;
    this.statusFilter.set(status && DOCUMENT_STATUS_INFO[status] ? new Set([status]) : new Set());
    this.employeeFilter.set(params.get('employeeId') || null);
  }

  load(): void {
    this.loading.set(true);
    this.service.search().subscribe({
      next: (list) => {
        this.documents.set(list ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        void this.showError(err, 'Não foi possível carregar os documentos.');
      },
    });
  }

  loadTypes(): void {
    this.service.listTypes().subscribe({
      next: (list) => this.types.set(list ?? []),
      error: (err) => void this.showError(err, 'Não foi possível carregar os tipos de documento.'),
    });
  }

  toggleStatus(status: EmployeeDocumentStatus): void {
    this.statusFilter.update(current => {
      const next = new Set(current);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  }

  isStatusOn(status: EmployeeDocumentStatus): boolean {
    return this.statusFilter().has(status);
  }

  clearFilters(): void {
    this.statusFilter.set(new Set());
    this.employeeFilter.set(null);
    this.typeFilter.set(null);
    this.search.set('');
  }

  statusLabel(status: EmployeeDocumentStatus): string {
    return DOCUMENT_STATUS_INFO[status].label;
  }

  statusIcon(status: EmployeeDocumentStatus): string {
    return DOCUMENT_STATUS_INFO[status].icon;
  }

  statusClass(status: EmployeeDocumentStatus): string {
    return `status-chip status-chip--${DOCUMENT_STATUS_INFO[status].severity}`;
  }

  chipClass(status: EmployeeDocumentStatus): string {
    const tone = status === 'EXPIRED' ? 'chip--atraso'
      : `chip--status chip--${DOCUMENT_STATUS_INFO[status].severity}`;
    const dashed = status === 'NO_DUE_DATE' || status === 'REPLACED' ? ' chip--tracejado' : '';
    return `chip ${tone}${dashed}`;
  }

  stamp(value: string | null): string {
    return formatStampBr(value, false);
  }

  // ─── Vincular e substituir ───────────────────────────────────────────────

  openLink(): void {
    this.linkPreset.set(null);
    this.linkOpen.set(true);
  }

  /** O mesmo formulário, já com quem, o quê e o documento que sai. */
  openReplace(document: EmployeeDocument): void {
    this.linkPreset.set({ employeeId: document.employeeId, typeId: document.typeId ?? undefined, replacesId: document.id });
    this.linkOpen.set(true);
  }

  onLinked(document: EmployeeDocument): void {
    this.linkOpen.set(false);
    this.messages.add({ severity: 'success', summary: 'Documento vinculado',
      detail: `${document.employeeName.split(' ')[0]} foi avisado.` });
    this.load();
  }

  // ─── Editar ───────────────────────────────────────────────────────────────

  openEdit(document: EmployeeDocument): void {
    this.editTitle.set(document.title);
    this.editTypeId.set(document.typeId);
    this.editDue.set(parseDateOnly(document.dueDate));
    this.editTarget.set(document);
  }

  saveEdit(): void {
    const target = this.editTarget();
    if (!target || !this.editTitle().trim() || this.editSaving()) return;

    this.editSaving.set(true);
    this.service.update(target.id, {
      title: this.editTitle().trim(),
      typeId: this.editTypeId(),
      dueDate: this.editDue() ? toIsoDate(this.editDue()!) : null,
    }).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.editTarget.set(null);
        this.messages.add({ severity: 'success', summary: 'Documento atualizado' });
        this.load();
      },
      error: (err) => {
        this.editSaving.set(false);
        void this.showError(err, 'Não foi possível salvar.');
      },
    });
  }

  // ─── Excluir ──────────────────────────────────────────────────────────────

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    this.service.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.messages.add({ severity: 'success', summary: 'Documento excluído' });
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        void this.showError(err, 'Não foi possível excluir.');
      },
    });
  }

  /** Excluir o SUBSTITUTO faz o anterior voltar a valer — a pergunta avisa. */
  readonly deleteRevivesPrevious = computed(() => {
    const target = this.deleteTarget();
    return !!target && this.documents().some(document => document.replacedById === target.id);
  });

  // ─── Baixar ───────────────────────────────────────────────────────────────

  download(document: EmployeeDocument): void {
    this.downloadingId.set(document.id);
    this.service.download(document.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.originalFilename || document.title;
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: (err) => {
        this.downloadingId.set(null);
        void this.showError(err, 'Não foi possível baixar o arquivo.');
      },
    });
  }

  private async showError(err: unknown, fallback: string): Promise<void> {
    this.messages.add({ severity: 'error', summary: 'Erro', detail: await apiMessageOrFallback(err, fallback) });
  }
}

/** Busca sem acento e sem caixa: "joao" acha "João". */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
