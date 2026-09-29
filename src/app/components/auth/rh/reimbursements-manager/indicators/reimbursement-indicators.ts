import { Reimbursement } from '../../../../../domain/models/hr/reimbursement.model';

/**
 * As contas da aba Indicadores — funções puras, sem Angular e sem relógio: tudo
 * recebe a lista e as datas. É o que deixa testar com datas fixas.
 *
 * **Pela data do gasto** (`expenseDate`), a mesma regra da faixa de totais e do
 * comprovante em PDF: o mesmo mês dá o mesmo número nas três telas.
 */

export type Granularity = 'month' | 'quarter' | 'year';

/** Um período fechado: `from` e `to` em `yyyy-MM-dd`, os dois inclusivos. */
export interface Period {
  granularity: Granularity;
  /** Ano e mês de referência (o mês âncora; no trimestre e no ano, qualquer mês dele). */
  year: number;
  month: number; // 1–12
  from: string;
  to: string;
  label: string;
}

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => `${n}`.padStart(2, '0');
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export function periodOf(granularity: Granularity, year: number, month: number): Period {
  if (granularity === 'month') {
    return { granularity, year, month, from: iso(year, month, 1), to: iso(year, month, lastDay(year, month)),
      label: `${capitalize(MONTH_NAMES[month - 1])} ${year}` };
  }
  if (granularity === 'quarter') {
    const quarter = Math.ceil(month / 3);
    const first = (quarter - 1) * 3 + 1;
    return { granularity, year, month, from: iso(year, first, 1), to: iso(year, first + 2, lastDay(year, first + 2)),
      label: `${quarter}º tri ${year}` };
  }
  return { granularity, year, month, from: iso(year, 1, 1), to: iso(year, 12, 31), label: `${year}` };
}

/** O período vizinho: -1 é o anterior (a comparação), +1 o seguinte. */
export function shiftPeriod(period: Period, step: number): Period {
  const months = period.granularity === 'month' ? 1 : period.granularity === 'quarter' ? 3 : 12;
  const index = period.year * 12 + (period.month - 1) + step * months;
  return periodOf(period.granularity, Math.floor(index / 12), (index % 12) + 1);
}

/** Como o período anterior se chama na frase "vs agosto", "vs 2º tri", "vs 2025". */
export function previousLabel(period: Period): string {
  const previous = shiftPeriod(period, -1);
  return period.granularity === 'month' ? MONTH_NAMES[previous.month - 1] : previous.label;
}

export function inPeriod(reimbursement: Reimbursement, period: Period): boolean {
  const day = reimbursement.expenseDate.slice(0, 10);
  return day >= period.from && day <= period.to;
}

// ─── Categorias ─────────────────────────────────────────────────────────────

/**
 * A chave de agrupamento: sem acento, sem caixa, espaços juntos. "Gasolina" e
 * "gasolina " viram uma barra só; "Combustível" continua outra (decisão dele).
 */
export function categoryKey(category: string | null | undefined): string {
  return (category ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim() || 'sem categoria';
}

// ─── Os indicadores ─────────────────────────────────────────────────────────

export interface Bucket { amount: number; count: number; }

export interface Kpis {
  requested: Bucket;
  approved: Bucket;
  paid: Bucket;
  pending: Bucket;
  /** Pedidos em análise há mais de 7 dias (pela data do pedido). */
  pendingOld: number;
  /** Aprovados ÷ decididos, em %. Nulo sem decisão no período. */
  approvalRate: number | null;
  averageTicket: number | null;
  /** Média de dias do pedido até a (primeira) análise. */
  daysToReview: number | null;
  /** Média de dias da aprovação até o pagamento. */
  daysToPay: number | null;
  contested: number;
  /** Contestados que terminaram aprovados ou pagos. */
  reverted: number;
}

const DAY_MS = 86_400_000;
const sum = (list: Reimbursement[]): Bucket => ({
  amount: round2(list.reduce((total, r) => total + (r.amount ?? 0), 0)),
  count: list.length,
});
const round2 = (value: number) => Math.round(value * 100) / 100;
const avg = (values: number[]) => values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Dias entre duas datas, pelo DIA (sem hora): pedido às 23h e análise às 8h do dia seguinte é 1. */
function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

export function computeKpis(all: Reimbursement[], period: Period, today: string): Kpis {
  const list = all.filter(r => inPeriod(r, period));
  const pending = list.filter(r => r.status === 'PENDING');
  const approved = list.filter(r => r.status === 'APPROVED');
  const paid = list.filter(r => r.status === 'PAID');
  const rejected = list.filter(r => r.status === 'REJECTED');
  const decided = approved.length + paid.length + rejected.length;

  // A PRIMEIRA análise: o contestado foi analisado duas vezes, e a espera que
  // conta é a do pedido original.
  const reviewDays = list
    .filter(r => r.firstReviewedAt ?? r.reviewedAt)
    .map(r => daysBetween(r.requestedAt, (r.firstReviewedAt ?? r.reviewedAt)!));

  const payDays = paid
    .filter(r => r.reviewedAt && r.paymentDate)
    .map(r => daysBetween(r.reviewedAt!, r.paymentDate!));

  const contested = list.filter(r => r.contestedAt);

  return {
    requested: sum(list),
    approved: sum(approved),
    paid: sum(paid),
    pending: sum(pending),
    pendingOld: pending.filter(r => daysBetween(r.requestedAt, today) > 7).length,
    approvalRate: decided ? Math.round((approved.length + paid.length) / decided * 100) : null,
    averageTicket: list.length ? round2(sum(list).amount / list.length) : null,
    daysToReview: avg(reviewDays),
    daysToPay: avg(payDays),
    contested: contested.length,
    reverted: contested.filter(r => r.status === 'APPROVED' || r.status === 'PAID').length,
  };
}

/** Variação em % (nulo quando não há base para comparar — "de zero" não tem porcentagem). */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round((current - previous) / previous * 100);
}

// ─── Evolução, rankings e situação ──────────────────────────────────────────

export interface MonthPoint { label: string; year: number; month: number; paid: number; approved: number; pending: number; }

/**
 * Os 12 meses que terminam no fim do período. Recusado fica fora: a coluna é
 * dinheiro que saiu ou vai sair.
 */
export function monthlyEvolution(all: Reimbursement[], period: Period): MonthPoint[] {
  const endMonth = +period.to.slice(5, 7);
  const endYear = +period.to.slice(0, 4);
  const points: MonthPoint[] = [];
  for (let step = 11; step >= 0; step--) {
    const index = endYear * 12 + (endMonth - 1) - step;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const monthPeriod = periodOf('month', year, month);
    const list = all.filter(r => inPeriod(r, monthPeriod));
    points.push({
      label: MONTH_SHORT[month - 1], year, month,
      paid: sum(list.filter(r => r.status === 'PAID')).amount,
      approved: sum(list.filter(r => r.status === 'APPROVED')).amount,
      pending: sum(list.filter(r => r.status === 'PENDING')).amount,
    });
  }
  return points;
}

export interface RankRow { key: string; label: string; amount: number; count: number; }

/**
 * Agrupa o que NÃO foi recusado — o ranking responde "para onde vai o
 * dinheiro", e um pedido recusado não custou nada. O rótulo é a grafia mais
 * usada do grupo ("Gasolina", e não "gasolina ").
 */
export function rankBy(list: Reimbursement[], keyOf: (r: Reimbursement) => string,
                       labelOf: (r: Reimbursement) => string): RankRow[] {
  const groups = new Map<string, { amount: number; count: number; labels: Map<string, number> }>();
  for (const r of list) {
    if (r.status === 'REJECTED') continue;
    const key = keyOf(r);
    const group = groups.get(key) ?? { amount: 0, count: 0, labels: new Map() };
    group.amount += r.amount ?? 0;
    group.count += 1;
    const label = labelOf(r);
    group.labels.set(label, (group.labels.get(label) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      label: [...g.labels.entries()].sort((a, b) => b[1] - a[1])[0][0],
      amount: round2(g.amount),
      count: g.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Os N primeiros e o resto somado em "Outros" — o donut não lê mais que seis fatias. */
export function topWithOthers(rows: RankRow[], top: number): RankRow[] {
  if (rows.length <= top + 1) return rows;
  const rest = rows.slice(top);
  return [...rows.slice(0, top), {
    key: '__outros', label: 'Outros',
    amount: round2(rest.reduce((a, r) => a + r.amount, 0)),
    count: rest.reduce((a, r) => a + r.count, 0),
  }];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
