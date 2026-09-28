import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkDialogComponent } from '../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { FormScreenComponent } from '../shared/form-screen/form-screen.component';
import { MonthSwitcherComponent, currentMonth } from '../shared/month-switcher/month-switcher.component';
import { ReimbursementTotalsComponent } from '../shared/reimbursement-totals/reimbursement-totals.component';
import { ehCelular } from '../../../infrastructure/state/eh-celular';
import { ReimbursementService } from '../../../infrastructure/services/hr/reimbursement.service';
import { Reimbursement, ReimbursementStatus, ReimbursementSummary } from '../../../domain/models/hr/reimbursement.model';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { formatDateBr, formatStampBr } from '../../../domain/utils/date-only';
import { apiMessage } from '../../../domain/utils/api-error';
import { lerValorDoCampo, valorMinimo } from '../../../infrastructure/validators/valor-decimal';

@Component({
  selector: 'app-hr-reimbursements',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePickerModule, PkButtonComponent, PkInputComponent,
    PkDialogComponent, PkSheetComponent, PageHeaderComponent, FormScreenComponent, MonthSwitcherComponent,
    ReimbursementTotalsComponent],
  templateUrl: './hr-reimbursements.component.html',
  styleUrl: './hr-reimbursements.component.scss',
})
export class HrReimbursementsComponent implements OnInit {
  reimbursements = signal<Reimbursement[]>([]);
  loading = signal(true);
  erro = signal(false);
  enviando = signal(false);
  /**
   * Por que o envio não saiu. Antes o erro só parava o spinner: a API recusava
   * com motivo ("data final antes da inicial", "valor maior que zero") e a
   * pessoa via o botão voltar ao normal sem saber de nada.
   */
  erroEnvio = signal<string | null>(null);
  baixandoId = signal<string | null>(null);

  readonly ehCelular = ehCelular();

  /**
   * Lista ou formulário. O formulário que ficava sempre aberto no topo virou
   * botão (desenho aprovado em 2026-09-28): quem abre a tela quer saber como
   * estão os pedidos, e criar fica a um toque.
   */
  mode = signal<'list' | 'form'>('list');

  /** `yyyy-MM`; totais e lista pela data do gasto, como o comprovante. */
  month = signal(currentMonth());
  summary = signal<ReimbursementSummary | null>(null);
  loadingSummary = signal(false);

  /** Os pedidos do mês escolhido. A lista inteira vem de uma vez; o recorte é aqui. */
  readonly doMes = computed(() => this.reimbursements().filter(r => r.expenseDate.startsWith(this.month())));

  // ── contestação ──
  contestTarget = signal<Reimbursement | null>(null);
  contestFile: File | null = null;
  contestComment = '';
  contestando = signal(false);
  erroContestacao = signal<string | null>(null);

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
      amount: ['', [Validators.required, valorMinimo(0.01)]],
      category: ['', Validators.required],
      reason: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.carregar();
    this.carregarTotais();
  }

  mudarMes(month: string): void {
    this.month.set(month);
    this.carregarTotais();
  }

  carregarTotais(): void {
    this.loadingSummary.set(true);
    this.service.getMySummary(this.month()).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loadingSummary.set(false);
      },
      // Sem totais a lista continua útil; os cartões mostram o traço.
      error: () => this.loadingSummary.set(false),
    });
  }

  abrirForm(): void {
    this.erroEnvio.set(null);
    this.mode.set('form');
  }

  fecharForm(): void {
    this.mode.set('list');
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
    this.erroEnvio.set(null);
    const { expenseDate, amount, category, reason } = this.form.value as {
      expenseDate: Date;
      amount: string;
      category: string;
      reason: string;
    };

    this.service
      .request({
        expenseDate: this.toIsoDate(expenseDate),
        // O campo entrega o texto da máscara ("1.234,56"); a API quer o número.
        amount: lerValorDoCampo(amount) ?? 0,
        category,
        reason,
        receipt: this.selectedReceipt,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.selectedReceipt = null;
          this.form.reset();
          this.mode.set('list');
          this.carregar();
          this.carregarTotais();
        },
        error: (err) => {
          this.enviando.set(false);
          this.erroEnvio.set(apiMessage(err) ?? 'Não foi possível enviar a solicitação. Tente de novo.');
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
    return formatDateBr(iso);
  }

  /** `LocalDateTime` da API (revisão, contestação, prazo) — lido por partes, sem fuso. */
  formatStamp(iso: string | null): string {
    return formatStampBr(iso).slice(0, 10);
  }

  // ── contestação ──

  abrirContestacao(r: Reimbursement): void {
    this.contestTarget.set(r);
    this.contestFile = null;
    this.contestComment = '';
    this.erroContestacao.set(null);
  }

  fecharContestacao(): void {
    this.contestTarget.set(null);
  }

  onContestFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.contestFile = input.files?.[0] ?? null;
  }

  get podeContestar(): boolean {
    return !!this.contestFile && this.contestComment.trim().length > 0 && !this.contestando();
  }

  contestar(): void {
    const target = this.contestTarget();
    if (!target || !this.podeContestar || !this.contestFile) return;
    this.contestando.set(true);
    this.erroContestacao.set(null);
    this.service.contest(target.id, this.contestComment.trim(), this.contestFile).subscribe({
      next: () => {
        this.contestando.set(false);
        this.contestTarget.set(null);
        this.carregar();
        this.carregarTotais();
      },
      error: (err) => {
        this.contestando.set(false);
        this.erroContestacao.set(apiMessage(err) ?? 'Não foi possível enviar a contestação. Tente de novo.');
      },
    });
  }

  statusLabel(status: ReimbursementStatus): string {
    return this.statusLabels[status];
  }

  /** `original`: o comprovante de antes da contestação. */
  baixarComprovante(reimbursement: Reimbursement, original = false): void {
    this.baixandoId.set(reimbursement.id + (original ? ':original' : ''));
    this.service.downloadReceipt(reimbursement.id, original).subscribe({
      next: (resp) => {
        this.triggerDownload(resp.body!, original
          ? reimbursement.originalReceiptFilename ?? 'comprovante-original'
          : reimbursement.receiptOriginalFilename);
        this.baixandoId.set(null);
      },
      error: () => this.baixandoId.set(null),
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
}
