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
}

export interface ReviewReimbursementPayload {
  notes: string;
}

export interface PayReimbursementPayload {
  paymentDate: string;
}
