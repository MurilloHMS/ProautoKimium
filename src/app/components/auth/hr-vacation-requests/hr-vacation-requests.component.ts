import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { VacationRequestService } from '../../../infrastructure/services/hr/vacation-request.service';
import { VacationRequest, VacationRequestStatus } from '../../../domain/models/hr/vacation-request.model';
import { countBusinessDays, getHolidaysInRange, HolidayInfo } from '../../../domain/utils/brazilian-business-days';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

@Component({
  selector: 'app-hr-vacation-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerModule, ToastModule, PkButtonComponent, PageHeaderComponent],
  providers: [MessageService],
  templateUrl: './hr-vacation-requests.component.html',
  styleUrl: './hr-vacation-requests.component.scss',
})
export class HrVacationRequestsComponent implements OnInit {
  balance = signal<number | null>(null);
  requests = signal<VacationRequest[]>([]);
  loading = signal(true);
  erro = signal(false);
  enviando = signal(false);

  form: FormGroup;

  private readonly statusLabels: Record<VacationRequestStatus, string> = {
    PENDING: 'Em análise',
    APPROVED: 'Aprovado',
    REJECTED: 'Recusado',
  };

  constructor(private service: VacationRequestService, private fb: FormBuilder, private messageService: MessageService) {
    this.form = this.fb.group({
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.service.getMyOverview().subscribe({
      next: (data) => {
        this.balance.set(data.vacationBalanceDays);
        this.requests.set(data.requests ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  get daysRequested(): number | null {
    const { startDate, endDate } = this.form.value as { startDate: Date | null; endDate: Date | null };
    if (!startDate || !endDate) return null;
    const days = countBusinessDays(startDate, endDate);
    return days > 0 ? days : null;
  }

  get holidaysInRange(): HolidayInfo[] {
    const { startDate, endDate } = this.form.value as { startDate: Date | null; endDate: Date | null };
    if (!startDate || !endDate) return [];
    return getHolidaysInRange(startDate, endDate);
  }

  get excedeSaldo(): boolean {
    const dias = this.daysRequested;
    const saldo = this.balance();
    return dias !== null && saldo !== null && dias > saldo;
  }

  get podeEnviar(): boolean {
    return this.form.valid && this.daysRequested !== null && !this.excedeSaldo;
  }

  enviar(): void {
    if (!this.podeEnviar) return;

    this.enviando.set(true);
    const { startDate, endDate } = this.form.value as { startDate: Date; endDate: Date };

    this.service
      .request({
        startDate: this.toIsoDate(startDate),
        endDate: this.toIsoDate(endDate),
        replacementEmployeeId: null,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.form.reset();
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Solicitação de férias enviada!' });
          this.carregar();
        },
        error: (err) => {
          this.enviando.set(false);
          const detail = this.getErrorMessage(err);
          this.messageService.add({ severity: 'error', summary: 'Erro', detail });
        },
      });
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  statusLabel(status: VacationRequestStatus): string {
    return this.statusLabels[status];
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 404: return 'Funcionário não encontrado. Verifique seu cadastro com o RH.';
      case 409: return err.error?.message ?? 'Saldo de férias insuficiente ou conflito de datas.';
      case 403: return 'Sem permissão para esta ação.';
      case 0:   return 'Sem conexão com o servidor.';
      default:  return `Erro inesperado (${err.status}).`;
    }
  }
}
