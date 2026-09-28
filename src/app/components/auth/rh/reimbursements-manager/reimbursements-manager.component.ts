import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { ReimbursementService } from '../../../../infrastructure/services/hr/reimbursement.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { Reimbursement, ReimbursementStatus, ReimbursementSummary } from '../../../../domain/models/hr/reimbursement.model';
import { MonthSwitcherComponent, currentMonth } from '../../shared/month-switcher/month-switcher.component';
import { ReimbursementTotalsComponent } from '../../shared/reimbursement-totals/reimbursement-totals.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import {ButtonDirective} from "primeng/button";
import {Tooltip} from "primeng/tooltip";
import { formatDateBr, formatStampBr } from '../../../../domain/utils/date-only';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { ReimbursementReportDialogComponent } from './report-dialog/reimbursement-report-dialog.component';

type ReviewAction = 'approve' | 'reject';

@Component({
  selector: 'app-reimbursements-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, DatePickerModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, ButtonDirective, Tooltip, ToolbarComponent, PkCanDirective, ReimbursementReportDialogComponent, MonthSwitcherComponent, ReimbursementTotalsComponent],
  templateUrl: './reimbursements-manager.component.html',
  styleUrl: './reimbursements-manager.component.scss',
  providers: [MessageService],
})
export class ReimbursementsManagerComponent implements OnInit {
  reimbursements: Reimbursement[] = [];
  loading = false;
  baixandoId: string | null = null;
  /** O comprovante para a diretoria: baixar o PDF ou mandar ao RH. */
  reportOpen = false;
  private readonly employeeStore = inject(EmployeeStore);

  statusFilter: ReimbursementStatus | null = 'PENDING';

  /** `yyyy-MM`; grade e totais pela data do gasto, como o comprovante. */
  month = currentMonth();
  summary: ReimbursementSummary | null = null;
  loadingSummary = false;
  statusOptions: { label: string; value: ReimbursementStatus | null }[] = [
    { label: 'Em análise', value: 'PENDING' },
    { label: 'Aprovados', value: 'APPROVED' },
    { label: 'Recusados', value: 'REJECTED' },
    { label: 'Pagos', value: 'PAID' },
    { label: 'Todos', value: null },
  ];

  reviewDialogVisible = false;
  reviewAction: ReviewAction = 'approve';
  reviewTarget: Reimbursement | null = null;
  reviewNotes = '';
  reviewSaving = false;

  payDialogVisible = false;
  payTarget: Reimbursement | null = null;
  payDate: Date | null = null;
  paySaving = false;

  constructor(
    private reimbursementService: ReimbursementService,
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.employeeStore.load();
    this.load();
  }

  /** O nome vem do store: a grade guarda o id, quem traduz é a lista compartilhada. */
  employeeName(employeeId: string): string {
    return this.employeeStore.nameOf(employeeId);
  }

  load(): void {
    this.loading = true;
    this.loadSummary();
    this.reimbursementService.getAll(this.statusFilter ?? undefined, this.month).subscribe({
      next: (list) => {
        this.reimbursements = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.reimbursementService.getSummary(this.month).subscribe({
      next: (s) => {
        this.summary = s;
        this.loadingSummary = false;
      },
      // Sem totais a grade continua útil; os cartões mostram o traço.
      error: () => (this.loadingSummary = false),
    });
  }

  changeMonth(month: string): void {
    this.month = month;
    this.load();
  }

  /** O cartão clicado vira o filtro de status — o mesmo do seletor da toolbar. */
  filterByCard(status: ReimbursementStatus | null): void {
    this.statusFilter = status;
    this.load();
  }

  /** `LocalDateTime` da API, lido por partes. */
  formatStamp(iso: string | null): string {
    return formatStampBr(iso).slice(0, 10);
  }

  statusLabel(status: ReimbursementStatus): string {
    switch (status) {
      case 'PENDING': return 'Em análise';
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Recusado';
      case 'PAID': return 'Pago';
    }
  }

  formatDate(iso: string): string {
    return formatDateBr(iso);
  }

  /** `original`: o comprovante de antes da contestação, que a primeira análise viu. */
  baixarComprovante(r: Reimbursement, original = false): void {
    this.baixandoId = r.id + (original ? ':original' : '');
    this.reimbursementService.downloadReceipt(r.id, original).subscribe({
      next: (resp) => {
        this.triggerDownload(resp.body!, original ? r.originalReceiptFilename ?? 'comprovante-original' : r.receiptOriginalFilename);
        this.baixandoId = null;
      },
      error: () => (this.baixandoId = null),
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  // ---- Aprovar / Recusar ----

  openReview(reimbursement: Reimbursement, action: ReviewAction): void {
    this.reviewTarget = reimbursement;
    this.reviewAction = action;
    this.reviewNotes = '';
    this.reviewDialogVisible = true;
  }

  get canConfirmReview(): boolean {
    if (this.reviewAction === 'reject') return this.reviewNotes.trim().length > 0;
    return true;
  }

  confirmReview(): void {
    if (!this.reviewTarget || !this.canConfirmReview) return;

    this.reviewSaving = true;
    const payload = { notes: this.reviewNotes };
    const call = this.reviewAction === 'approve'
      ? this.reimbursementService.approve(this.reviewTarget.id, payload)
      : this.reimbursementService.reject(this.reviewTarget.id, payload);

    call.subscribe({
      next: () => {
        this.reviewSaving = false;
        this.reviewDialogVisible = false;
        this.load();
        this.msgService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: this.reviewAction === 'approve' ? 'Reembolso aprovado!' : 'Reembolso recusado!',
        });
      },
      error: (err) => {
        this.reviewSaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // ---- Pagar ----

  openPay(reimbursement: Reimbursement): void {
    this.payTarget = reimbursement;
    this.payDate = null;
    this.payDialogVisible = true;
  }

  confirmPay(): void {
    if (!this.payTarget || !this.payDate) return;

    this.paySaving = true;
    this.reimbursementService.pay(this.payTarget.id, { paymentDate: this.toIsoDate(this.payDate) }).subscribe({
      next: () => {
        this.paySaving = false;
        this.payDialogVisible = false;
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Pagamento registrado!' });
      },
      error: (err) => {
        this.paySaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      // A API escreve a mensagem da regra ("Você não pode revisar o seu próprio
      // pedido", "Motivo é obrigatório…"): o texto genérico só entra se ela faltar.
      case 400: return err.error?.message ?? 'Requisição inválida';
      case 403: return err.error?.message ?? 'Você não tem permissão para esta ação';
      case 404: return err.error?.message ?? 'Funcionário ou reembolso não encontrado. Verifique se seu usuário está vinculado a um funcionário.';
      case 409: return err.error?.message ?? 'Conflito ao processar a solicitação';
      case 422: return err.error?.message ?? 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
