import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PkKpiComponent } from '../../../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { ReimbursementService } from '../../../../../infrastructure/services/hr/reimbursement.service';
import { EmployeeStore } from '../../../../../infrastructure/state/employee.store';
import { TeamStore } from '../../../../../infrastructure/state/org-structure.store';
import { Reimbursement } from '../../../../../domain/models/hr/reimbursement.model';
import { apiMessageOrFallback } from '../../../../../domain/utils/api-error';
import {
  Kpis, Period, RankRow,
  categoryKey, computeKpis, inPeriod, monthlyEvolution, percentChange,
  previousLabel, rankBy, shiftPeriod, topWithOthers,
} from './reimbursement-indicators';

/** O recorte que um clique no gráfico manda para a aba Pedidos. */
export interface IndicatorDrill {
  employeeId?: string;
  categoryKey?: string;
  departmentId?: string;
  /** "Diego Martins · 3º tri 2026" — o chip que a aba Pedidos mostra. */
  label: string;
  from: string;
  to: string;
}

/** Os números que se comparam com o período anterior — nomeados porque o template não aceita arrow function. */
const METRICS = {
  requested: (k: Kpis) => k.requested.amount,
  approved: (k: Kpis) => k.approved.amount,
  paid: (k: Kpis) => k.paid.amount,
  averageTicket: (k: Kpis) => k.averageTicket,
  approvalRate: (k: Kpis) => k.approvalRate,
  daysToReview: (k: Kpis) => k.daysToReview,
  daysToPay: (k: Kpis) => k.daysToPay,
} satisfies Record<string, (k: Kpis) => number | null>;

export type Metric = keyof typeof METRICS;

/** As cores das fatias, na ordem do ranking — os papéis do tema, não hex solto. */
const SLICE_COLORS = ['var(--app-action)', 'var(--app-info)', 'var(--app-success)',
  'var(--app-warning)', 'var(--app-work)', 'var(--app-text-subtle)'];

/**
 * A aba Indicadores do reembolso (aprovada em 2026-09-29).
 *
 * Carrega a lista inteira uma vez (`GET /hr/reimbursements` sem mês) e faz as
 * contas aqui, com as funções puras de `reimbursement-indicators.ts`: trocar
 * de período não vai à API. Gráficos em CSS, como o resto do projeto.
 */
@Component({
  selector: 'app-reimbursement-indicators',
  standalone: true,
  imports: [CommonModule, PkKpiComponent],
  templateUrl: './reimbursement-indicators.component.html',
  styleUrl: './reimbursement-indicators.component.scss',
})
export class ReimbursementIndicatorsComponent implements OnInit {

  private readonly service = inject(ReimbursementService);
  private readonly employeeStore = inject(EmployeeStore);
  private readonly teamStore = inject(TeamStore);

  /** Um clique numa barra ou fatia: a tela abre os pedidos com esse recorte. */
  readonly drill = output<IndicatorDrill>();

  /**
   * O período é um só na tela (2026-09-29): quem escolhe Mês/Trimestre/Ano e
   * anda no ‹ › é a tela, com o mesmo seletor para Pedidos e Indicadores.
   */
  readonly period = input.required<Period>();

  readonly all = signal<Reimbursement[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly previous = computed(() => shiftPeriod(this.period(), -1));
  readonly vsLabel = computed(() => previousLabel(this.period()));

  private readonly today = isoToday();

  readonly kpis = computed<Kpis>(() => computeKpis(this.all(), this.period(), this.today));
  readonly prevKpis = computed<Kpis>(() => computeKpis(this.all(), this.previous(), this.today));

  readonly evolution = computed(() => monthlyEvolution(this.all(), this.period()));
  readonly evolutionMax = computed(() =>
    Math.max(1, ...this.evolution().map(p => p.paid + p.approved + p.pending)));

  private readonly inPeriodList = computed(() => this.all().filter(r => inPeriod(r, this.period())));

  readonly categories = computed(() => topWithOthers(
    rankBy(this.inPeriodList(), r => categoryKey(r.category), r => r.category.trim() || 'Sem categoria'), 5));
  readonly categoriesTotal = computed(() => this.categories().reduce((a, r) => a + r.amount, 0));

  /** O donut em `conic-gradient` — o mesmo desenho do Hub de máquinas. */
  readonly donut = computed(() => {
    const total = this.categoriesTotal();
    if (!total) return 'var(--app-surface-3)';
    let start = 0;
    const stops = this.categories().map((row, i) => {
      const end = start + row.amount / total * 360;
      const stop = `${SLICE_COLORS[i % SLICE_COLORS.length]} ${start}deg ${end}deg`;
      start = end;
      return stop;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  readonly employees = computed(() => rankBy(this.inPeriodList(),
    r => r.employeeId, r => this.employeeStore.nameOf(r.employeeId)).slice(0, 6));

  /**
   * Por departamento, pelo setor do funcionário (o setor pertence a um
   * departamento). Sem a permissão de ler a estrutura, a lista de setores não
   * vem — e o cartão simplesmente não aparece.
   */
  readonly departments = computed(() => {
    const teams = new Map(this.teamStore.items().map(team => [team.id, team.department]));
    if (!teams.size) return [];
    const employees = new Map(this.employeeStore.items().map(e => [e.id, e.teamId]));
    const departmentOf = (r: Reimbursement) => teams.get(employees.get(r.employeeId) ?? '') ?? null;
    return rankBy(this.inPeriodList(),
      r => departmentOf(r)?.id ?? '__sem',
      r => departmentOf(r)?.name ?? 'Sem departamento').slice(0, 6);
  });

  readonly statusBars = computed(() => {
    const list = this.inPeriodList();
    const amount = (status: Reimbursement['status']) =>
      list.filter(r => r.status === status).reduce((a, r) => a + r.amount, 0);
    const rows = [
      { label: 'Pago', color: 'var(--app-success)', amount: amount('PAID') },
      { label: 'Aprovado a pagar', color: 'var(--app-info)', amount: amount('APPROVED') },
      { label: 'Em análise', color: 'var(--app-warning)', amount: amount('PENDING') },
      { label: 'Recusado', color: 'var(--app-danger)', amount: amount('REJECTED') },
    ];
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return rows.map(r => ({ ...r, percent: total ? Math.round(r.amount / total * 100) : 0 }));
  });

  ngOnInit(): void {
    this.employeeStore.load();
    this.teamStore.load();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAll().subscribe({
      next: (list) => {
        this.all.set(list ?? []);
        this.loading.set(false);
      },
      error: async (err) => {
        this.loading.set(false);
        this.error.set(await apiMessageOrFallback(err, 'Não foi possível carregar os indicadores.'));
      },
    });
  }

  // ─── Comparação ───────────────────────────────────────────────────────────

  /** % contra o período anterior; nulo sem base ("de zero" não tem porcentagem). */
  change(metric: Metric): number | null {
    const now = METRICS[metric](this.kpis());
    const before = METRICS[metric](this.prevKpis());
    return now === null || before === null ? null : percentChange(now, before);
  }

  /** Diferença absoluta (pontos da taxa, dias dos prazos). */
  diff(metric: Metric): number | null {
    const now = METRICS[metric](this.kpis());
    const before = METRICS[metric](this.prevKpis());
    return now === null || before === null ? null : Math.round((now - before) * 10) / 10;
  }

  // ─── Cliques que viram recorte na aba Pedidos ────────────────────────────

  openEmployee(row: RankRow): void {
    this.drill.emit({ employeeId: row.key, label: `${row.label} · ${this.period().label}`, ...this.range() });
  }

  openCategory(row: RankRow): void {
    if (row.key === '__outros') return;
    this.drill.emit({ categoryKey: row.key, label: `${row.label} · ${this.period().label}`, ...this.range() });
  }

  openDepartment(row: RankRow): void {
    if (row.key === '__sem') return;
    this.drill.emit({ departmentId: row.key, label: `${row.label} · ${this.period().label}`, ...this.range() });
  }

  private range(): { from: string; to: string } {
    return { from: this.period().from, to: this.period().to };
  }

  sliceColor(index: number): string {
    return SLICE_COLORS[index % SLICE_COLORS.length];
  }

  percentOf(value: number, max: number): number {
    return max ? Math.round(value / max * 100) : 0;
  }
}

function isoToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
}
