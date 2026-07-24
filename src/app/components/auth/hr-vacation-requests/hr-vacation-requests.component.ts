import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { VacationRequestService } from '../../../infrastructure/services/hr/vacation-request.service';
import { VacationRequest, VacationRequestStatus } from '../../../domain/models/hr/vacation-request.model';

@Component({
  selector: 'app-hr-vacation-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerModule, PkButtonComponent],
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

  constructor(private service: VacationRequestService, private fb: FormBuilder) {
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
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : null;
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
          this.carregar();
        },
        error: () => this.enviando.set(false),
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
}
