export type VacationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VacationRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  replacementEmployeeId: string | null;
  status: VacationRequestStatus;
  requestedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface EmployeeVacationOverview {
  vacationBalanceDays: number | null;
  requests: VacationRequest[];
}
