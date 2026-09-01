import { Component, signal, OnInit, inject } from '@angular/core';
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
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { VacationAlert, VacationRequest, VacationRequestStatus } from '../../../../domain/models/hr/vacation-request.model';
import { countBusinessDays, getHolidaysInRange, HolidayInfo } from '../../../../domain/utils/brazilian-business-days';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { formatDateBr } from '../../../../domain/utils/date-only';

type ReviewAction = 'approve' | 'reject';

@Component({
  selector: 'app-vacation-requests-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, SelectModule, DatePickerModule, InputNumberModule, Toast, PkButtonComponent, PkDialogComponent, FormScreenComponent, PkTableComponent, ButtonDirective, Tooltip, ToolbarComponent],
  templateUrl: './vacation-requests-manager.component.html',
  styleUrl: './vacation-requests-manager.component.scss',
  providers: [MessageService],
})
export class VacationRequestsManagerComponent implements OnInit, TabDirtyCheck {

  /** Lançamento em andamento avisa antes de fechar a aba. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.registerForm.dirty;
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  requests: VacationRequest[] = [];
  loading = false;
  private readonly employeeStore = inject(EmployeeStore);

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

  /** grade ou lançamento de férias. A análise (aprovar/recusar) segue em diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');
  registerForm: FormGroup;
  registerSaving = false;
  /** Só ativos: lançar férias para quem foi desligado não faz sentido. */
  readonly employeeOptions = this.employeeStore.activeOptions;
  setBalance = false;

  /**
   * Liga e desliga o campo de saldo — e a exigência junto.
   *
   * Marcar a caixa e deixar o campo vazio manda `null`, e `null` é o sinal de
   * "não informado": a API desconta os dias em vez de gravar o valor. Ou seja,
   * a caixa faria o **oposto** do que promete, sem erro nenhum na tela.
   *
   * Zero é um valor legítimo aqui: é o RH lançando as últimas férias e dizendo
   * que a pessoa fica zerada.
   */
  onSetBalanceChange(ligado: boolean): void {
    this.setBalance = ligado;
    const campo = this.registerForm.get('vacationBalanceDays');

    if (ligado) {
      campo?.addValidators(Validators.required);
    } else {
      campo?.clearValidators();
      campo?.setValue(null);
    }
    campo?.updateValueAndValidity();
  }

  constructor(
    private vacationRequestService: VacationRequestService,
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
    this.employeeStore.load();
    this.load();
    this.loadAlerts();
  }

  /** O nome vem do store: a solicitação guarda o id, quem traduz é a lista compartilhada. */
  employeeName(employeeId: string): string {
    return this.employeeStore.nameOf(employeeId);
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
    return formatDateBr(iso);
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
    this.onSetBalanceChange(false);
    this.mode.set('form');
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
        this.mode.set('grid');
        this.load();
        this.loadAlerts();
        // Lançar férias consome saldo do funcionário: a lista compartilhada
        // precisa refletir isso nas outras abas.
        if (this.setBalance) this.employeeStore.refresh();
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
