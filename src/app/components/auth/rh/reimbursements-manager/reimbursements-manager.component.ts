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
import { Reimbursement, ReimbursementStatus } from '../../../../domain/models/hr/reimbursement.model';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import {ButtonDirective} from "primeng/button";
import {Tooltip} from "primeng/tooltip";
import { formatDateBr } from '../../../../domain/utils/date-only';

type ReviewAction = 'approve' | 'reject';

@Component({
  selector: 'app-reimbursements-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, DatePickerModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, ButtonDirective, Tooltip, ToolbarComponent],
  templateUrl: './reimbursements-manager.component.html',
  styleUrl: './reimbursements-manager.component.scss',
  providers: [MessageService],
})
export class ReimbursementsManagerComponent implements OnInit {
  reimbursements: Reimbursement[] = [];
  loading = false;
  baixandoId: string | null = null;
  private readonly employeeStore = inject(EmployeeStore);

  statusFilter: ReimbursementStatus | null = 'PENDING';
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
    this.reimbursementService.getAll(this.statusFilter ?? undefined).subscribe({
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

  baixarComprovante(r: Reimbursement): void {
    this.baixandoId = r.id;
    this.reimbursementService.downloadReceipt(r.id).subscribe({
      next: (resp) => {
        this.triggerDownload(resp.body!, r.receiptOriginalFilename);
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
      case 400: return 'Requisição inválida';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return err.error?.message ?? 'Funcionário ou reembolso não encontrado. Verifique se seu usuário está vinculado a um funcionário.';
      case 409: return err.error?.message ?? 'Conflito ao processar a solicitação';
      case 422: return 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
