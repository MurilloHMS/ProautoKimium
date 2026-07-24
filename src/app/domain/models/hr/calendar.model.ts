export type CalendarEventType = 'VACATION';
export type CalendarEventStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CalendarEvent {
  id: string;
  eventType: CalendarEventType;
  employeeId: string;
  employeeName: string;
  teamId: string | null;
  teamName: string | null;
  startDate: string;
  endDate: string;
  status: CalendarEventStatus;
}
