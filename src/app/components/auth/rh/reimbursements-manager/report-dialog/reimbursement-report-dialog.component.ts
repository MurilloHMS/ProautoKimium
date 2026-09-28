import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PkSegmentedComponent, PkSegmentedOption } from '../../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkCheckboxComponent } from '../../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkCanDirective } from '../../../../../infrastructure/directives/pk-can.directive';
import { ReimbursementService } from '../../../../../infrastructure/services/hr/reimbursement.service';
import { HrReportRecipientService } from '../../../../../infrastructure/services/hr/hr-report-recipient.service';
import { EmployeeStore } from '../../../../../infrastructure/state/employee.store';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import { ReimbursementStatus } from '../../../../../domain/models/hr/reimbursement.model';
import {
  HrReportRecipient,
  ReimbursementReportFilter,
  ReportEmailResult,
} from '../../../../../domain/models/hr/reimbursement-report.model';
import { formatDateOnly } from '../../../../../domain/utils/date-only';
import { apiMessageOrFallback } from '../../../../../domain/utils/api-error';

type Preset = 'this' | 'last' | 'three';

/** Os status na ordem do ciclo de vida, com o rótulo do PDF. */
export const REPORT_STATUSES: { value: ReimbursementStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'APPROVED', label: 'Aprovado' },
  { value: 'PAID', label: 'Pago' },
  { value: 'REJECTED', label: 'Recusado' },
];

/**
 * O comprovante de reembolsos para a diretoria: baixar o PDF ou mandar ao RH.
 *
 * Desenho aprovado em 2026-09-28 (Artifact "Comprovante na tela"). Diálogo, e
 * não modo formulário: são três campos e nada é gravado. No celular vira a
 * folha, como a Programação — mesmo corpo, duas molduras, por `ngTemplateOutlet`.
 *
 * Os filtros são os mesmos para os dois botões, e é de propósito: o que se
 * baixa é exatamente o que se envia.
 */
@Component({
  selector: 'app-reimbursement-report-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePickerModule, SelectModule,
    PkButtonComponent, PkDialogComponent, PkSheetComponent, PkSegmentedComponent, PkCheckboxComponent,
    PkCanDirective,
  ],
  templateUrl: './reimbursement-report-dialog.component.html',
  styleUrl: './reimbursement-report-dialog.component.scss',
})
export class ReimbursementReportDialogComponent {
  private readonly reimbursements = inject(ReimbursementService);
  private readonly recipientsApi = inject(HrReportRecipientService);
  private readonly employeeStore = inject(EmployeeStore);

  readonly open = input(false);
  readonly closed = output<void>();

  readonly ehCelular = ehCelular();
  readonly statusOptions = REPORT_STATUSES;
  readonly presetOptions: PkSegmentedOption[] = [
    { label: 'Este mês', value: 'this' },
    { label: 'Mês passado', value: 'last' },
    { label: 'Últimos 3 meses', value: 'three' },
  ];

  // ── filtros ──
  readonly preset = signal<Preset | null>('this');
  from: Date | null = null;
  to: Date | null = null;
  employeeId: string | null = null;
  /** Pendente, Aprovado e Pago: o recorte do exemplo que foi à diretoria. */
  selected: Record<ReimbursementStatus, boolean> = { PENDING: true, APPROVED: true, PAID: true, REJECTED: false };

  /** Todos, inclusive quem já saiu: o período pode pegar alguém desligado. */
  readonly employeeOptions = computed(() => [
    { label: 'Todos os funcionários', value: null as string | null },
    ...this.employeeStore.options(),
  ]);

  // ── estado ──
  readonly mode = signal<'form' | 'recipients'>('form');
  readonly recipients = signal<HrReportRecipient[]>([]);
  readonly recipientsLoaded = signal(false);
  readonly downloading = signal(false);
  readonly sending = signal(false);
  readonly result = signal<ReportEmailResult | null>(null);
  readonly error = signal<string | null>(null);

  newEmail = '';
  readonly adding = signal(false);
  readonly recipientError = signal<string | null>(null);

  constructor() {
    this.applyPreset('this');
    // Cada abertura começa limpa: o resultado do envio anterior não pode
    // parecer o deste. `untracked` para só o `open` disparar o efeito.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.mode.set('form');
        this.result.set(null);
        this.error.set(null);
        this.employeeStore.load();
        this.loadRecipients();
      });
    });
  }

  // ── período ──

  applyPreset(preset: Preset): void {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    // Dia 0 do mês seguinte = último dia deste: vale para fevereiro e 30/31.
    const ranges: Record<Preset, [Date, Date]> = {
      this: [new Date(y, m, 1), new Date(y, m + 1, 0)],
      last: [new Date(y, m - 1, 1), new Date(y, m, 0)],
      three: [new Date(y, m - 2, 1), new Date(y, m + 1, 0)],
    };
    [this.from, this.to] = ranges[preset];
    this.preset.set(preset);
  }

  /** Mexeu na data à mão: nenhum atalho descreve mais o período. */
  onDateEdited(): void {
    this.preset.set(null);
  }

  get statuses(): ReimbursementStatus[] {
    return REPORT_STATUSES.map(s => s.value).filter(v => this.selected[v]);
  }

  /** O motivo de o botão estar desligado, para dizer na tela e não só desligar. */
  get invalidReason(): string | null {
    if (!this.from || !this.to) return 'Informe o início e o fim do período.';
    if (this.to < this.from) return 'O fim do período não pode ser antes do início.';
    if (this.statuses.length === 0) return 'Escolha pelo menos um status.';
    return null;
  }

  get withAnnexes(): boolean {
    return this.employeeId !== null;
  }

  filter(): ReimbursementReportFilter {
    return {
      from: formatDateOnly(this.from)!,
      to: formatDateOnly(this.to)!,
      statuses: this.statuses,
      employeeId: this.employeeId,
    };
  }

  // ── baixar ──

  download(): void {
    if (this.invalidReason || this.downloading()) return;
    this.downloading.set(true);
    this.error.set(null);
    const filter = this.filter();
    this.reimbursements.downloadReport(filter).subscribe({
      next: (resp) => {
        this.downloading.set(false);
        saveBlob(resp.body!, fileNameOf(resp) ?? `comprovante-reembolsos_${filter.from}_${filter.to}.pdf`);
        this.closed.emit();
      },
      error: async (err) => {
        this.downloading.set(false);
        this.error.set(await apiMessageOrFallback(err, 'Não foi possível gerar o comprovante. Tente de novo.'));
      },
    });
  }

  // ── enviar ──

  get noRecipients(): boolean {
    return this.recipientsLoaded() && this.recipients().length === 0;
  }

  send(): void {
    if (this.invalidReason || this.sending() || this.noRecipients) return;
    this.sending.set(true);
    this.error.set(null);
    this.result.set(null);
    this.reimbursements.emailReport(this.filter()).subscribe({
      next: (result) => {
        this.sending.set(false);
        this.result.set(result);
      },
      error: async (err) => {
        this.sending.set(false);
        this.error.set(await apiMessageOrFallback(err, 'O e-mail não saiu. Tente de novo em instantes.'));
      },
    });
  }

  // ── destinatários ──

  private loadRecipients(): void {
    this.recipientsApi.list().subscribe({
      next: (list) => {
        this.recipients.set(list);
        this.recipientsLoaded.set(true);
      },
      // Sem a lista, o envio mostra o aviso da API; não trava o PDF.
      error: () => this.recipientsLoaded.set(false),
    });
  }

  addRecipient(): void {
    const email = this.newEmail.trim();
    if (!email || this.adding()) return;
    this.adding.set(true);
    this.recipientError.set(null);
    this.recipientsApi.add(email).subscribe({
      next: (created) => {
        this.adding.set(false);
        this.newEmail = '';
        this.recipients.update(list => [...list, created].sort((a, b) => a.email.localeCompare(b.email)));
        this.recipientsLoaded.set(true);
      },
      error: async (err) => {
        this.adding.set(false);
        this.recipientError.set(await apiMessageOrFallback(err, 'Não foi possível adicionar o e-mail.'));
      },
    });
  }

  removeRecipient(recipient: HrReportRecipient): void {
    this.recipientError.set(null);
    this.recipientsApi.remove(recipient.id).subscribe({
      next: () => this.recipients.update(list => list.filter(r => r.id !== recipient.id)),
      error: async (err) => {
        this.recipientError.set(await apiMessageOrFallback(err, 'Não foi possível remover o e-mail.'));
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}

/** `attachment; filename="x.pdf"` → `x.pdf`. */
export function fileNameOf(resp: HttpResponse<Blob>): string | null {
  const header = resp.headers.get('Content-Disposition');
  const match = header ? /filename="?([^";]+)"?/.exec(header) : null;
  return match ? match[1] : null;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
