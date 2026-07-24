export interface SendNotificationPayload {
  employeeIds: string[] | null;
  title: string;
  message: string;
  link: string | null;
}

export interface SendNotificationResult {
  notified: number;
  skippedNoAccount: number;
}
