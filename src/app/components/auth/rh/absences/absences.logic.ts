import { CalendarEvent } from '../../../../domain/models/hr/calendar.model';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';

/**
 * Ausências: férias e atestados na mesma faixa de dias.
 *
 * Datas como texto `AAAA-MM-DD` de ponta a ponta: comparar texto nesse formato
 * é comparar datas, e não há fuso para escorregar um dia.
 */

export type AbsenceKind = 'VACATION' | 'CERTIFICATE';

export interface Absence {
  employeeId: string;
  name: string;
  kind: AbsenceKind;
  /** Férias pedidas e ainda não aprovadas: aparecem tracejadas, não contam como fora. */
  pending: boolean;
  start: string;
  end: string;
}

/** O que cada dia da faixa mostra. Atestado vence férias no mesmo dia; aprovada vence pedida. */
export type DayMark = 'CERTIFICATE' | 'VACATION' | 'VACATION_PENDING' | null;

export interface AbsenceRow {
  employeeId: string;
  name: string;
  days: DayMark[];
}

export interface AbsenceSummary {
  outToday: number;
  leavingSoon: number;
  pendingRequests: number;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** A segunda-feira da semana de `d`: a faixa começa sempre numa segunda. */
export function weekStart(d: Date): Date {
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

export function windowDays(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Férias recusadas não são ausência. */
export function fromCalendar(events: CalendarEvent[]): Absence[] {
  return events
    .filter(e => e.status !== 'REJECTED')
    .map(e => ({
      employeeId: e.employeeId, name: e.employeeName, kind: 'VACATION' as const,
      pending: e.status === 'PENDING', start: e.startDate, end: e.endDate,
    }));
}

/**
 * Atestado recusado também não: o RH disse que aquele papel não vale. O que
 * está em conferência conta — a pessoa faltou, o RH só não conferiu ainda.
 */
export function fromCertificates(certificates: MedicalCertificate[]): Absence[] {
  return certificates
    .filter(c => c.status !== 'REJECTED')
    .map(c => ({
      employeeId: c.employeeId, name: c.employeeName, kind: 'CERTIFICATE' as const,
      pending: false, start: c.startDate, end: c.endDate,
    }));
}

function covers(a: Absence, day: string): boolean {
  return a.start <= day && day <= a.end;
}

const RANK: Record<Exclude<DayMark, null>, number> = { CERTIFICATE: 3, VACATION: 2, VACATION_PENDING: 1 };

function markOf(a: Absence): Exclude<DayMark, null> {
  if (a.kind === 'CERTIFICATE') return 'CERTIFICATE';
  return a.pending ? 'VACATION_PENDING' : 'VACATION';
}

/** Uma linha por pessoa com alguma ausência na janela, em ordem de nome. */
export function buildRows(absences: Absence[], days: Date[]): AbsenceRow[] {
  const keys = days.map(isoDay);
  const byEmployee = new Map<string, Absence[]>();
  for (const a of absences) byEmployee.set(a.employeeId, [...(byEmployee.get(a.employeeId) ?? []), a]);

  const rows: AbsenceRow[] = [];
  for (const [employeeId, list] of byEmployee) {
    const marks = keys.map(day => {
      let best: DayMark = null;
      for (const a of list) {
        if (!covers(a, day)) continue;
        const m = markOf(a);
        if (best === null || RANK[m] > RANK[best]) best = m;
      }
      return best;
    });
    if (marks.some(m => m !== null)) rows.push({ employeeId, name: list[0].name, days: marks });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * O resumo de cima.
 *
 * - **Fora hoje:** pessoas distintas com férias aprovadas ou atestado hoje.
 * - **Saem nos próximos 7 dias:** férias aprovadas que começam de amanhã a +7.
 * - **Pedidos esperando:** férias pedidas que ainda não terminaram.
 */
export function summarize(absences: Absence[], today: Date): AbsenceSummary {
  const t = isoDay(today);
  const soon = isoDay(addDays(today, 7));
  const out = new Set(absences.filter(a => !a.pending && covers(a, t)).map(a => a.employeeId));
  const leaving = new Set(absences
    .filter(a => a.kind === 'VACATION' && !a.pending && a.start > t && a.start <= soon)
    .map(a => a.employeeId));
  return {
    outToday: out.size,
    leavingSoon: leaving.size,
    pendingRequests: absences.filter(a => a.pending && a.end >= t).length,
  };
}

/** As ausências que tocam a janela, da que começa antes para a depois — a lista do celular. */
export function inWindow(absences: Absence[], days: Date[]): Absence[] {
  const first = isoDay(days[0]);
  const last = isoDay(days[days.length - 1]);
  return absences
    .filter(a => a.start <= last && a.end >= first)
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'pt-BR'));
}
