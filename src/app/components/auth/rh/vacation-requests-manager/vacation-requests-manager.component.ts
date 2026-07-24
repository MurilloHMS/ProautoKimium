import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { VacationRequest, VacationRequestStatus } from '../../../../domain/models/hr/vacation-request.model';

type ReviewAction = 'approve' | 'reject';

@Component({
  selector: 'app-vacation-requests-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent],
  templateUrl: './vacation-requests-manager.component.html',
  styleUrl: './vacation-requests-manager.component.scss',
  providers: [MessageService],
})
export class VacationRequestsManagerComponent implements OnInit {
  requests: VacationRequest[] = [];
  loading = false;
  employeeNames = new Map<string, string>();

  statusFilter: VacationRequestStatus | null = 'PENDING';
  statusOptions: { label: string; value: VacationRequestStatus | null }[] = [
    { label: 'Pendentes', value: 'PENDING' },
    { label: 'Aprovadas', value: 'APPROVED' },
    { label: 'Recusadas', value: 'REJECTED' },
    { label: 'Todas', value: null },
  ];

  reviewDialogVisible = false;
  reviewAction: ReviewAction = 'approve';
  reviewTarget: VacationRequest | null = null;
  reviewNotes = '';
  reviewSaving = false;

  constructor(
    private vacationRequestService: VacationRequestService,
    private employeeService: EmployeeService,
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadEmployeeNames();
    this.load();
  }

  loadEmployeeNames(): void {
    this.employeeService.getEmployes().subscribe({
      next: (list) => {
        this.employeeNames = new Map(list.filter((e) => e.id).map((e) => [e.id as string, e.name]));
      },
      error: () => (this.employeeNames = new Map()),
    });
  }

  employeeName(employeeId: string): string {
    return this.employeeNames.get(employeeId) ?? employeeId;
  }

  load(): void {
    this.loading = true;
    this.vacationRequestService.getAll(this.statusFilter ?? undefined).subscribe({
      next: (list) => {
        this.requests = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  statusLabel(status: VacationRequestStatus): string {
    switch (status) {
      case 'PENDING': return 'Em análise';
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Recusado';
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  openReview(request: VacationRequest, action: ReviewAction): void {
    this.reviewTarget = request;
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
      ? this.vacationRequestService.approve(this.reviewTarget.id, payload)
      : this.vacationRequestService.reject(this.reviewTarget.id, payload);

    call.subscribe({
      next: () => {
        this.reviewSaving = false;
        this.reviewDialogVisible = false;
        this.load();
        this.msgService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: this.reviewAction === 'approve' ? 'Solicitação aprovada!' : 'Solicitação recusada!',
        });
      },
      error: (err) => {
        this.reviewSaving = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Recurso não encontrado';
      case 409: return 'Registro já existe';
      case 422: return 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
