import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../theme/ProautoKimium/pk-input/pk-input.component';
import { ReimbursementService } from '../../../infrastructure/services/hr/reimbursement.service';
import { Reimbursement, ReimbursementStatus } from '../../../domain/models/hr/reimbursement.model';

@Component({
  selector: 'app-hr-reimbursements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerModule, PkButtonComponent, PkInputComponent],
  templateUrl: './hr-reimbursements.component.html',
  styleUrl: './hr-reimbursements.component.scss',
})
export class HrReimbursementsComponent implements OnInit {
  reimbursements = signal<Reimbursement[]>([]);
  loading = signal(true);
  erro = signal(false);
  enviando = signal(false);
  baixandoId = signal<string | null>(null);

  selectedReceipt: File | null = null;

  form: FormGroup;

  private readonly statusLabels: Record<ReimbursementStatus, string> = {
    PENDING: 'Em análise',
    APPROVED: 'Aprovado',
    REJECTED: 'Recusado',
    PAID: 'Pago',
  };

  constructor(private service: ReimbursementService, private fb: FormBuilder) {
    this.form = this.fb.group({
      expenseDate: [null, Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      category: ['', Validators.required],
      reason: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.service.getMine().subscribe({
      next: (data) => {
        this.reimbursements.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  onReceiptSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedReceipt = input.files?.[0] ?? null;
  }

  get podeEnviar(): boolean {
    return this.form.valid && !!this.selectedReceipt;
  }

  enviar(): void {
    if (!this.podeEnviar || !this.selectedReceipt) return;

    this.enviando.set(true);
    const { expenseDate, amount, category, reason } = this.form.value as {
      expenseDate: Date;
      amount: number;
      category: string;
      reason: string;
    };

    this.service
      .request({
        expenseDate: this.toIsoDate(expenseDate),
        amount,
        category,
        reason,
        receipt: this.selectedReceipt,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.selectedReceipt = null;
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

  statusLabel(status: ReimbursementStatus): string {
    return this.statusLabels[status];
  }

  baixarComprovante(reimbursement: Reimbursement): void {
    this.baixandoId.set(reimbursement.id);
    this.service.downloadReceipt(reimbursement.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = reimbursement.receiptOriginalFilename;
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoId.set(null);
      },
      error: () => this.baixandoId.set(null),
    });
  }
}
