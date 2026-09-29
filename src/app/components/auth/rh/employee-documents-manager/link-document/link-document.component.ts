import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PkComboboxComponent } from '../../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkFileUploadComponent } from '../../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { EmployeeStore } from '../../../../../infrastructure/state/employee.store';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import {
  EmployeeDocumentService,
  toIsoDate,
} from '../../../../../infrastructure/services/hr/employee-document.service';
import {
  EmployeeDocument,
  EmployeeDocumentType,
} from '../../../../../domain/models/hr/employee-document.model';
import { apiMessageOrFallback } from '../../../../../domain/utils/api-error';

/** De onde o formulário parte: "Vincular" vem vazio; "Substituir" vem preenchido. */
export interface LinkPreset {
  employeeId?: string;
  typeId?: string;
  replacesId?: string;
}

/**
 * Vincular documento — diálogo no computador, folha de baixo no celular
 * (o padrão do registrar pagamento e do calendário da Programação).
 *
 * **O substituto se sugere sozinho.** Quando o funcionário já tem um documento
 * ATIVO do mesmo tipo, o aviso aparece com "Substitui o anterior" marcado: um
 * ASO novo quase sempre toma o lugar do velho, e esquecer de marcar deixaria o
 * velho gerando aviso de vencimento para sempre.
 */
@Component({
  selector: 'app-link-document',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerModule, InputTextModule, PkButtonComponent,
    PkDialogComponent, PkSheetComponent, PkComboboxComponent, PkFileUploadComponent],
  templateUrl: './link-document.component.html',
  styleUrl: './link-document.component.scss',
})
export class LinkDocumentComponent {

  private readonly service = inject(EmployeeDocumentService);
  private readonly employeeStore = inject(EmployeeStore);

  readonly open = input(false);
  readonly preset = input<LinkPreset | null>(null);
  /** A lista da tela: é dela que sai o documento ativo a substituir. */
  readonly documents = input<EmployeeDocument[]>([]);
  readonly types = input<EmployeeDocumentType[]>([]);

  readonly closed = output<void>();
  readonly linked = output<EmployeeDocument>();

  readonly ehCelular = ehCelular();

  readonly employeeId = signal<string | null>(null);
  readonly typeId = signal<string | null>(null);
  readonly title = signal('');
  readonly file = signal<File | null>(null);
  readonly hasDueDate = signal(true);
  readonly dueDate = signal<Date | null>(null);
  readonly replace = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** O título acompanha o tipo até a pessoa escrever o dela. */
  private titleTouched = false;

  readonly employeeOptions = this.employeeStore.activeOptions;

  /** Só tipos ativos recebem documento novo. */
  readonly typeOptions = computed(() =>
    this.types().filter(type => type.active).map(type => ({ label: type.name, value: type.id })));

  readonly selectedType = computed(() => this.types().find(type => type.id === this.typeId()) ?? null);

  /**
   * O documento ativo do mesmo funcionário e tipo — o candidato a ser
   * substituído. "Ativo" é tudo menos substituído: um vencido também é
   * substituível, e é justamente o caso mais comum.
   */
  readonly replaceable = computed(() => {
    const employee = this.employeeId();
    const type = this.typeId();
    if (!employee || !type) return null;
    return this.documents().find(document =>
      document.employeeId === employee && document.typeId === type && document.status !== 'REPLACED') ?? null;
  });

  /** Os nomes de quem recebe o aviso, para a frase que confirma a data. */
  readonly recipientNames = computed(() =>
    (this.selectedType()?.recipientEmployeeIds ?? []).map(id => this.employeeStore.nameOf(id).split(' ')[0]));

  readonly canSave = computed(() =>
    !!this.employeeId() && !!this.typeId() && !!this.file() && !this.saving()
    && (!this.hasDueDate() || !!this.dueDate()));

  readonly employeeFirstName = computed(() => {
    const id = this.employeeId();
    return id ? this.employeeStore.nameOf(id).split(' ')[0] : '';
  });

  constructor() {
    this.employeeStore.load();

    // Cada abertura começa do zero (ou do preset do "Substituir"): um arquivo
    // escolhido e desistido não pode reaparecer no próximo vínculo.
    effect(() => {
      if (!this.open()) return;
      const preset = this.preset();
      this.employeeId.set(preset?.employeeId ?? null);
      this.typeId.set(preset?.typeId ?? null);
      // `untracked`: os tipos recarregando com o formulário aberto não podem
      // apagar o que a pessoa já preencheu.
      this.title.set(untracked(() => this.types()).find(type => type.id === preset?.typeId)?.name ?? '');
      this.titleTouched = false;
      this.file.set(null);
      this.hasDueDate.set(true);
      this.dueDate.set(null);
      this.replace.set(true);
      this.error.set(null);
    });
  }

  pickType(typeId: string | null): void {
    this.typeId.set(typeId);
    if (!this.titleTouched) {
      this.title.set(this.types().find(type => type.id === typeId)?.name ?? '');
    }
  }

  editTitle(value: string): void {
    this.titleTouched = true;
    this.title.set(value);
  }

  pickFile(files: File[]): void {
    this.file.set(files[0] ?? null);
  }

  /**
   * Os atalhos contam de HOJE: o documento novo começa a valer agora, e é daqui
   * que a validade de um ASO ou de uma NR se conta.
   */
  quickDue(months: number): void {
    const today = new Date();
    this.hasDueDate.set(true);
    this.dueDate.set(new Date(today.getFullYear(), today.getMonth() + months, today.getDate()));
  }

  isQuickDue(months: number): boolean {
    const due = this.dueDate();
    if (!due) return false;
    const today = new Date();
    return due.toDateString()
      === new Date(today.getFullYear(), today.getMonth() + months, today.getDate()).toDateString();
  }

  save(): void {
    const employeeId = this.employeeId();
    const typeId = this.typeId();
    const file = this.file();
    if (!this.canSave() || !employeeId || !typeId || !file) return;

    this.saving.set(true);
    this.error.set(null);

    const replaceable = this.replaceable();
    this.service.link({
      employeeId,
      typeId,
      title: this.title().trim(),
      dueDate: this.hasDueDate() && this.dueDate() ? toIsoDate(this.dueDate()!) : null,
      replacesId: replaceable && this.replace() ? replaceable.id : null,
      file,
    }).subscribe({
      next: (document) => {
        this.saving.set(false);
        this.linked.emit(document);
      },
      error: async (err) => {
        this.saving.set(false);
        this.error.set(await apiMessageOrFallback(err, 'Não foi possível vincular o documento.'));
      },
    });
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }
}
