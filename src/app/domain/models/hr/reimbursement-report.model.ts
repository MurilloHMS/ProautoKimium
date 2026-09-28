import { ReimbursementStatus } from './reimbursement.model';

/** Os filtros do comprovante — os mesmos para baixar e para enviar ao RH. */
export interface ReimbursementReportFilter {
  /** `yyyy-MM-dd`, data da despesa. */
  from: string;
  to: string;
  statuses: ReimbursementStatus[];
  /** Ausente = todos os funcionários. Com um só, a API anexa os comprovantes. */
  employeeId: string | null;
}

/** O que saiu e o que não saiu: dizer só "enviado" esconderia quem não recebeu. */
export interface ReportEmailResult {
  fileName: string;
  sentTo: string[];
  failed: string[];
}

export interface HrReportRecipient {
  id: string;
  email: string;
  createdAt: string;
  createdBy: string;
}
