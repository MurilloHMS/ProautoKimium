import { Reimbursement } from '../../../../domain/models/hr/reimbursement.model';

/**
 * A fila de reembolsos da Pendências: agrupar por pessoa e marcar o que merece
 * olho antes de aprovar em lote.
 *
 * Funções puras, fora do componente: é aqui que mora a regra, e é aqui que o
 * teste olha. O componente só desenha.
 */

export type ReimbursementAlertKind = 'DUPLICATE' | 'ABOVE_USUAL';

export interface ReimbursementAlert {
  kind: ReimbursementAlertKind;
  label: string;
}

export interface ReimbursementGroup {
  employeeId: string;
  employeeName: string;
  items: Reimbursement[];
  total: number;
  /** "Combustível 6, Alimentação 3" — as categorias, da mais frequente para a menos. */
  categories: string;
  /** O pedido mais antigo do grupo: é por ele que a fila se ordena. */
  oldest: string;
  /** Alertas por pedido; pedido sem alerta não aparece no mapa. */
  alerts: Map<string, ReimbursementAlert[]>;
}

/** Abaixo disso a mediana da categoria não diz nada. */
export const MIN_SAMPLE_FOR_USUAL = 5;
/** "Acima do comum" é passar deste múltiplo da mediana da categoria. */
export const ABOVE_USUAL_FACTOR = 2;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A mediana de cada categoria, sobre a base que a tela tiver (os pedidos do mês
 * mais os pendentes). Categoria com menos de {@link MIN_SAMPLE_FOR_USUAL}
 * pedidos fica de fora: com três hospedagens, qualquer uma "está acima".
 */
export function usualByCategory(baseline: Reimbursement[]): Map<string, number> {
  const byCategory = new Map<string, number[]>();
  for (const r of baseline) {
    const key = r.category.trim().toLowerCase();
    byCategory.set(key, [...(byCategory.get(key) ?? []), Number(r.amount)]);
  }
  const usual = new Map<string, number>();
  for (const [key, values] of byCategory) {
    if (values.length < MIN_SAMPLE_FOR_USUAL) continue;
    const m = median(values);
    if (m !== null && m > 0) usual.set(key, m);
  }
  return usual;
}

/**
 * Os alertas de cada pedido pendente.
 *
 * - **Repetido:** a mesma pessoa, o mesmo valor e a mesma data do gasto em mais
 *   de um pedido. É o comprovante mandado duas vezes, o caso que mais acontece
 *   com quem envia muitos.
 * - **Acima do comum:** mais que {@link ABOVE_USUAL_FACTOR}× a mediana da
 *   categoria.
 */
export function alertsFor(pending: Reimbursement[], usual: Map<string, number>): Map<string, ReimbursementAlert[]> {
  const alerts = new Map<string, ReimbursementAlert[]>();
  const add = (id: string, alert: ReimbursementAlert) => alerts.set(id, [...(alerts.get(id) ?? []), alert]);

  const sameKey = new Map<string, Reimbursement[]>();
  for (const r of pending) {
    const key = `${r.employeeId}|${Number(r.amount).toFixed(2)}|${r.expenseDate}`;
    sameKey.set(key, [...(sameKey.get(key) ?? []), r]);
  }
  for (const group of sameKey.values()) {
    if (group.length < 2) continue;
    for (const r of group) {
      add(r.id, { kind: 'DUPLICATE', label: `Mesmo valor e dia, ${group.length}×` });
    }
  }

  for (const r of pending) {
    const m = usual.get(r.category.trim().toLowerCase());
    if (m !== undefined && Number(r.amount) > m * ABOVE_USUAL_FACTOR) {
      add(r.id, { kind: 'ABOVE_USUAL', label: `${r.category} acima do comum (mediana ${BRL.format(m)})` });
    }
  }
  return alerts;
}

/** Os pendentes agrupados por pessoa, o grupo com o pedido mais antigo primeiro. */
export function groupByEmployee(
  pending: Reimbursement[],
  nameOf: (employeeId: string) => string,
  alerts: Map<string, ReimbursementAlert[]>,
): ReimbursementGroup[] {
  const byEmployee = new Map<string, Reimbursement[]>();
  for (const r of pending) {
    byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);
  }

  const groups: ReimbursementGroup[] = [];
  for (const [employeeId, items] of byEmployee) {
    const sorted = [...items].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
    const counts = new Map<string, number>();
    for (const r of sorted) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const groupAlerts = new Map<string, ReimbursementAlert[]>();
    for (const r of sorted) {
      const a = alerts.get(r.id);
      if (a) groupAlerts.set(r.id, a);
    }
    groups.push({
      employeeId,
      employeeName: nameOf(employeeId),
      items: sorted,
      total: sorted.reduce((sum, r) => sum + Number(r.amount), 0),
      categories: [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([category, n]) => `${category} ${n}`)
        .join(', '),
      oldest: sorted[0].requestedAt,
      alerts: groupAlerts,
    });
  }
  return groups.sort((a, b) => a.oldest.localeCompare(b.oldest));
}

/** Quanto tempo o pedido está esperando, como o RH fala: "hoje", "1 dia", "4 dias". */
export function waitingFor(since: string, now: Date): string {
  const start = new Date(since);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((today - startDay) / 86_400_000));
  return days === 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`;
}

/**
 * O comprovante abre em `iframe` (PDF) ou em `img` (foto). O tipo do arquivo
 * manda; sem tipo, a extensão do nome decide — foto de celular às vezes chega
 * como `application/octet-stream`.
 */
export function isPdfReceipt(blobType: string, filename: string): boolean {
  if (blobType === 'application/pdf') return true;
  if (blobType.startsWith('image/')) return false;
  return filename.toLowerCase().endsWith('.pdf');
}
