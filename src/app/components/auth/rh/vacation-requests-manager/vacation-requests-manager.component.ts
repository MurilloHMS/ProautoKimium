import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { Employee } from '../../../../domain/models/employee.model';
import { VacationAlert, VacationRequest, VacationRequestStatus } from '../../../../domain/models/hr/vacation-request.model';
import { countBusinessDays, getHolidaysInRange, HolidayInfo } from '../../../../domain/utils/brazilian-business-days';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';

type ReviewAction = 'approve' | 'reject';

@Component({
  selector: 'app-vacation-requests-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, SelectModule, DatePickerModule, InputNumberModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, ButtonDirective, Tooltip, ToolbarComponent],
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

  alerts: VacationAlert[] = [];
  alertsLoading = false;
  showAlerts = false;

  reviewDialogVisible = false;
  reviewAction: ReviewAction = 'approve';
  reviewTarget: VacationRequest | null = null;
  reviewNotes = '';
  reviewSaving = false;

  registerDialogVisible = false;
  registerForm: FormGroup;
  registerSaving = false;
  employeeOptions: { label: string; value: string }[] = [];
  setBalance = false;

  constructor(
    private vacationRequestService: VacationRequestService,
    private employeeService: EmployeeService,
    private msgService: MessageService,
    private fb: FormBuilder
  ) {
    this.registerForm = this.fb.group({
      employeeId: ['', Validators.required],
      startDate: [null as Date | null, Validators.required],
      endDate: [null as Date | null, Validators.required],
      vacationBalanceDays: [null as number | null],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.loadEmployeeNames();
    this.load();
    this.loadAlerts();
  }

  loadEmployeeNames(): void {
    this.employeeService.getEmployes().subscribe({
      next: (list: Employee[]) => {
        this.employeeNames = new Map(list.filter((e) => e.id).map((e) => [e.id as string, e.name]));
        this.employeeOptions = list
          .filter((e) => e.id && e.ativo)
          .map((e) => ({ label: e.name, value: e.id as string }));
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

  loadAlerts(): void {
    this.alertsLoading = true;
    this.vacationRequestService.getAlerts().subscribe({
      next: (list) => {
        this.alerts = list.filter(a => a.alertLevel !== 'OK');
        this.alertsLoading = false;
        this.showAlerts = this.alerts.length > 0;
      },
      error: () => {
        this.alertsLoading = false;
      },
    });
  }

  alertIcon(level: string): string {
    switch (level) {
      case 'EXPIRED': return 'pi pi-exclamation-circle';
      case 'CRITICAL': return 'pi pi-exclamation-triangle';
      default: return 'pi pi-info-circle';
    }
  }

  alertLabel(level: string): string {
    switch (level) {
      case 'EXPIRED': return 'Vencido';
      case 'CRITICAL': return 'Critico';
      case 'WARNING': return 'Atencao';
      default: return level;
    }
  }

  openRegisterDialog(): void {
    this.registerForm.reset();
    this.setBalance = false;
    this.registerDialogVisible = true;
  }

  get registerDaysRequested(): number | null {
    const start = this.registerForm.get('startDate')?.value;
    const end = this.registerForm.get('endDate')?.value;
    if (!start || !end) return null;
    const days = countBusinessDays(start, end);
    return days > 0 ? days : null;
  }

  get registerHolidays(): HolidayInfo[] {
    const start = this.registerForm.get('startDate')?.value;
    const end = this.registerForm.get('endDate')?.value;
    if (!start || !end) return [];
    return getHolidaysInRange(start, end);
  }

  submitRegister(): void {
    if (this.registerForm.invalid || !this.registerDaysRequested) return;

    this.registerSaving = true;
    const v = this.registerForm.value;

    const formatDate = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    this.vacationRequestService.registerByRh({
      employeeId: v.employeeId,
      startDate: formatDate(v.startDate),
      endDate: formatDate(v.endDate),
      vacationBalanceDays: this.setBalance ? v.vacationBalanceDays : null,
      notes: v.notes || null,
    }).subscribe({
      next: () => {
        this.registerSaving = false;
        this.registerDialogVisible = false;
        this.load();
        this.loadAlerts();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Férias lançadas com sucesso!' });
      },
      error: (err) => {
        this.registerSaving = false;
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
