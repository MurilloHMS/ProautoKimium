import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { ReimbursementService } from '../../../../infrastructure/services/hr/reimbursement.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { Reimbursement, ReimbursementStatus, ReimbursementSummary } from '../../../../domain/models/hr/reimbursement.model';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import {ButtonDirective} from "primeng/button";
import {Tooltip} from "primeng/tooltip";
import { formatDateBr, formatStampBr } from '../../../../domain/utils/date-only';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { ReimbursementReportDialogComponent } from './report-dialog/reimbursement-report-dialog.component';
import { IndicatorDrill, ReimbursementIndicatorsComponent } from './indicators/reimbursement-indicators.component';
import { Granularity, categoryKey, inPeriod, periodOf, shiftPeriod } from './indicators/reimbursement-indicators';
import { PeriodPickerComponent } from './indicators/period-picker.component';
import { TeamStore } from '../../../../infrastructure/state/org-structure.store';

type ReviewAction = 'approve' | 'reject';

/**
 * Os recortes da aba Pedidos, na cor do selo de cada status. "Em análise" é o
 * único que pede ação do RH, e por isso o único sólido; "Recusados" não pede
 * nada, e é tracejado — o padrão da Programação A.
 */
interface StatusChip {
  label: string;
  value: ReimbursementStatus | null;
  icon: string;
  tone: 'acao' | 'success' | 'paid' | 'danger' | 'neutral';
  dashed?: boolean;
}

@Component({
  selector: 'app-reimbursements-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, DatePickerModule, InputText, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, ButtonDirective, Tooltip, PkCanDirective, ReimbursementReportDialogComponent, PkSheetComponent, ReimbursementIndicatorsComponent, PeriodPickerComponent],
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
  private readonly teamStore = inject(TeamStore);

  /** A aba aberta: os pedidos ou os Indicadores (2026-09-29). */
  readonly aba = signal<'pedidos' | 'indicadores'>('pedidos');


  /**
   * O recorte que veio de um clique nos Indicadores — funcionário, categoria ou
   * departamento num período. Enquanto existe, a lista vem inteira da API e é
   * filtrada aqui, porque o período pode ser um trimestre ou um ano, e a lista
   * normal é de um mês só.
   */
  readonly recorte = signal<IndicatorDrill | null>(null);

  statusFilter: ReimbursementStatus | null = 'PENDING';

  /**
   * O período da tela, um só para Pedidos e Indicadores (2026-09-29): Mês,
   * Trimestre ou Ano, e o ‹ › que anda nele. Sempre pela data do gasto, como o
   * comprovante.
   */
  readonly granularity = signal<Granularity>('month');
  private readonly anchor = signal(anchorOf(new Date()));
  readonly period = computed(() => periodOf(this.granularity(), this.anchor().year, this.anchor().month));

  /** O futuro não tem gasto: o ‹ › para no período de hoje. */
  readonly canGoForward = computed(() => {
    const today = anchorOf(new Date());
    return this.period().from < periodOf(this.granularity(), today.year, today.month).from;
  });

  /** "Set 2026" no lugar de "Setembro 2026": a barra do celular é estreita. */
  readonly periodShortLabel = computed(() => {
    const p = this.period();
    return p.granularity === 'month' ? `${SHORT_MONTHS[p.month - 1]} ${p.year}` : p.label;
  });

  /** O mês do período em `yyyy-MM` — o que a API recebe no `?month=`. */
  get month(): string {
    const a = this.anchor();
    return `${a.year}-${String(a.month).padStart(2, '0')}`;
  }
  set month(month: string) {
    const [year, m] = month.split('-').map(Number);
    this.anchor.set({ year, month: m });
  }

  readonly summary = signal<ReimbursementSummary | null>(null);

  readonly ehCelular = ehCelular();
  /** Celular: a busca abre por cima da linha. */
  searchOpen = false;
  loadingSummary = false;

  /**
   * Os cartões de total saíram (2026-09-29): a análise mora nos Indicadores, e
   * aqui ficou a lista. A contagem do mês foi para os chips — o número continua
   * à vista, e é ele mesmo o filtro.
   */
  readonly statusChips: StatusChip[] = [
    { label: 'Em análise', value: 'PENDING', icon: 'pi pi-hourglass', tone: 'acao' },
    { label: 'A pagar', value: 'APPROVED', icon: 'pi pi-check', tone: 'success' },
    { label: 'Pagos', value: 'PAID', icon: 'pi pi-wallet', tone: 'paid' },
    { label: 'Recusados', value: 'REJECTED', icon: 'pi pi-times', tone: 'danger', dashed: true },
    { label: 'Todos', value: null, icon: 'pi pi-list', tone: 'neutral' },
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
    this.pedidosStale = false;
    const recorte = this.recorte();

    // Mês: a API filtra e conta — o caminho de sempre.
    if (!recorte && this.granularity() === 'month') {
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
      return;
    }

    // Trimestre, ano ou recorte dos Indicadores: a API só filtra por mês, então
    // a lista vem inteira e o corte é aqui — e as contagens dos chips também.
    this.reimbursementService.getAll().subscribe({
      next: (list) => {
        const inRange = recorte ? list.filter(r => this.noRecorte(r, recorte)) : list.filter(r => inPeriod(r, this.period()));
        this.summary.set(summaryOf(inRange, this.period().label));
        this.reimbursements = this.statusFilter ? inRange.filter(r => r.status === this.statusFilter) : inRange;
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
        this.summary.set(s);
        this.loadingSummary = false;
      },
      // Sem totais a grade continua útil; os cartões mostram o traço.
      error: () => (this.loadingSummary = false),
    });
  }

  setGranularity(granularity: Granularity): void {
    if (granularity === this.granularity()) return;
    this.granularity.set(granularity);
    this.periodChanged();
  }

  movePeriod(step: number): void {
    if (step > 0 && !this.canGoForward()) return;
    const next = shiftPeriod(this.period(), step);
    this.anchor.set({ year: next.year, month: next.month });
    this.periodChanged();
  }

  /**
   * Trocar o período é voltar ao modo normal: o recorte era de outro. A lista
   * só é buscada na aba Pedidos; nos Indicadores ela fica marcada como velha.
   */
  private periodChanged(): void {
    this.recorte.set(null);
    if (this.aba() === 'pedidos') this.load();
    else this.pedidosStale = true;
  }

  /** O período mudou nos Indicadores: a lista de Pedidos está velha até voltar. */
  private pedidosStale = false;

  openTab(tab: 'pedidos' | 'indicadores'): void {
    this.aba.set(tab);
    if (tab === 'pedidos' && this.pedidosStale) this.load();
  }

  /** Um clique num gráfico dos Indicadores: volta para Pedidos, já recortado. */
  onDrill(drill: IndicatorDrill): void {
    this.recorte.set(drill);
    this.statusFilter = null;
    this.aba.set('pedidos');
    this.load();
  }

  limparRecorte(): void {
    this.recorte.set(null);
    this.load();
  }

  /** O pedido cai no recorte: pela data do gasto, e pelo funcionário, categoria ou departamento. */
  private noRecorte(r: Reimbursement, recorte: IndicatorDrill): boolean {
    const day = r.expenseDate.slice(0, 10);
    if (day < recorte.from || day > recorte.to) return false;
    if (recorte.employeeId && r.employeeId !== recorte.employeeId) return false;
    if (recorte.categoryKey && categoryKey(r.category) !== recorte.categoryKey) return false;
    if (recorte.departmentId) {
      const teamId = this.employeeStore.items().find(e => e.id === r.employeeId)?.teamId;
      const team = this.teamStore.items().find(t => t.id === teamId);
      if (team?.department?.id !== recorte.departmentId) return false;
    }
    return true;
  }

  /** Um chip ligado por vez: tocar no que já está ligado não faz nada. */
  filterByStatus(status: ReimbursementStatus | null): void {
    if (status === this.statusFilter) return;
    this.statusFilter = status;
    this.load();
  }

  /**
   * A contagem de cada chip no período: no mês vem da API; no trimestre, no
   * ano e no recorte dos Indicadores é contada aqui, da mesma lista que a
   * grade mostra. Recusado não vem separado: é o que foi pedido menos os
   * outros três.
   */
  countOf(status: ReimbursementStatus | null): number | null {
    const s = this.summary();
    if (!s) return null;
    switch (status) {
      case 'PENDING': return s.pending.count;
      case 'APPROVED': return s.approved.count;
      case 'PAID': return s.paid.count;
      case 'REJECTED': return Math.max(0, s.sent.count - s.pending.count - s.approved.count - s.paid.count);
      default: return s.sent.count;
    }
  }

  /** O foco vai no mesmo toque: o teclado do iPhone só sobe assim. */
  openSearch(input: HTMLInputElement): void {
    this.searchOpen = true;
    input.focus();
  }

  closeSearch(input: HTMLInputElement): void {
    this.searchOpen = false;
    input.value = '';
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

  /** "Hoje" é 0, "Ontem" é 1: os dias de quase todo pagamento, a um toque. */
  payQuickDate(daysAgo: number): void {
    const today = new Date();
    this.payDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
  }

  /** O atalho fica marcado quando o dia escolhido é o dele, venha de onde vier. */
  isPayDay(daysAgo: number): boolean {
    if (!this.payDate) return false;
    const today = new Date();
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    return this.payDate.toDateString() === day.toDateString();
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

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function anchorOf(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Os totais que a API dá para um mês, contados aqui para um trimestre, um ano ou um recorte. */
function summaryOf(list: Reimbursement[], label: string): ReimbursementSummary {
  const bucket = (status?: ReimbursementStatus) => {
    const rows = status ? list.filter(r => r.status === status) : list;
    return { amount: rows.reduce((a, r) => a + r.amount, 0), count: rows.length };
  };
  return {
    month: label,
    sent: bucket(),
    pending: bucket('PENDING'),
    approved: bucket('APPROVED'),
    paid: bucket('PAID'),
    contestedPending: list.filter(r => r.status === 'PENDING' && r.contestedAt).length,
  };
}
