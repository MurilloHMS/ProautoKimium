import { CareerChangeReason, CareerHistoryResponse } from '../../../../domain/models/hr/career.model';
import { EmployeeDocument, DOCUMENT_STATUS_ORDER } from '../../../../domain/models/hr/employee-document.model';
import { VacationRequest } from '../../../../domain/models/hr/vacation-request.model';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';

/**
 * A ficha do funcionário (2026-10-05): as regras de leitura, fora do componente.
 */

export const REASON_LABEL: Record<CareerChangeReason, string> = {
  HIRING: 'Admissão',
  PROMOTION: 'Promoção',
  POSITION_CHANGE: 'Mudança de cargo',
  COLLECTIVE_BARGAINING_ADJUSTMENT: 'Dissídio',
  PJ_TRANSITION: 'Passou a PJ',
  TERMINATION: 'Desligamento',
};

/** A carreira do mais recente para o mais antigo; empate de data, o lançado depois primeiro. */
export function careerNewestFirst(list: CareerHistoryResponse[]): CareerHistoryResponse[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.effectiveDate.localeCompare(a.item.effectiveDate) || b.index - a.index)
    .map(x => x.item);
}

/**
 * Documentos na ordem em que pedem atenção: vencido, vencendo, válido, sem
 * vencimento. O substituído sai da lista principal — ele é histórico, e a
 * tela de Documentos continua mostrando.
 */
export function documentsByAttention(list: EmployeeDocument[]): EmployeeDocument[] {
  return list
    .filter(d => d.status !== 'REPLACED')
    .sort((a, b) => DOCUMENT_STATUS_ORDER.indexOf(a.status) - DOCUMENT_STATUS_ORDER.indexOf(b.status)
      || a.title.localeCompare(b.title, 'pt-BR'));
}

export type AbsenceEntryKind = 'VACATION' | 'CERTIFICATE';

export interface AbsenceEntry {
  id: string;
  kind: AbsenceEntryKind;
  start: string;
  end: string;
  days: number;
  /** O rótulo da situação, como o RH fala. */
  status: string;
  tone: 'active' | 'warning' | 'danger' | 'neutral';
}

const VACATION_STATUS: Record<VacationRequest['status'], [string, AbsenceEntry['tone']]> = {
  APPROVED: ['Aprovadas', 'active'],
  PENDING: ['Aguardando aprovação', 'warning'],
  REJECTED: ['Recusadas', 'danger'],
};

const CERTIFICATE_STATUS: Record<MedicalCertificate['status'], [string, AbsenceEntry['tone']]> = {
  RECEIVED: ['Recebido', 'active'],
  PENDING: ['Em conferência', 'warning'],
  REJECTED: ['Recusado', 'danger'],
};

/** Férias e atestados numa linha do tempo só, do mais recente para o mais antigo. */
export function absenceTimeline(vacations: VacationRequest[], certificates: MedicalCertificate[]): AbsenceEntry[] {
  const entries: AbsenceEntry[] = [
    ...vacations.map(v => ({
      id: v.id, kind: 'VACATION' as const, start: v.startDate, end: v.endDate, days: v.daysRequested,
      status: VACATION_STATUS[v.status][0], tone: VACATION_STATUS[v.status][1],
    })),
    ...certificates.map(c => ({
      id: c.id, kind: 'CERTIFICATE' as const, start: c.startDate, end: c.endDate, days: c.daysCount,
      status: CERTIFICATE_STATUS[c.status][0], tone: CERTIFICATE_STATUS[c.status][1],
    })),
  ];
  return entries.sort((a, b) => b.start.localeCompare(a.start));
}

/** "Ana Maria Souza" → "AS": a primeira e a última inicial. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
