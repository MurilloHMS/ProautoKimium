export type ReimbursementStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Reimbursement {
  id: string;
  employeeId: string;
  expenseDate: string;
  amount: number;
  category: string;
  reason: string;
  receiptOriginalFilename: string;
  status: ReimbursementStatus;
  requestedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  paymentDate: string | null;
  paidAt: string | null;
  /** Contestação (uma só, até 30 dias). Preenchido quando o dono contestou. */
  contestedAt: string | null;
  contestComment: string | null;
  /** O comprovante de antes da contestação; baixa com `?original=true`. */
  originalReceiptFilename: string | null;
  firstReviewedById: string | null;
  firstReviewedAt: string | null;
  firstReviewNotes: string | null;
  /** Só vem quando ainda dá para contestar: é o que mostra o botão e o "até 28/10". */
  contestDeadline: string | null;
}

/** Totais do mês, pela data da despesa — a mesma regra do comprovante. */
export interface ReimbursementBucket {
  amount: number;
  count: number;
}

export interface ReimbursementSummary {
  month: string;
  /** Tudo que foi pedido no mês, inclusive recusado. */
  sent: ReimbursementBucket;
  pending: ReimbursementBucket;
  /** Aprovado e ainda não pago. */
  approved: ReimbursementBucket;
  paid: ReimbursementBucket;
  /** Quantos dos pendentes são contestação. */
  contestedPending: number;
}

export interface ReviewReimbursementPayload {
  notes: string;
}

export interface PayReimbursementPayload {
  paymentDate: string;
}
