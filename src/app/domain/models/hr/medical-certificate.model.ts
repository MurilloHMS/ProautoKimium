export type SubmissionType = 'PHOTO' | 'FILE';

export interface MedicalCertificate {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  submissionType: SubmissionType;
  confirmedLegible: boolean | null;
  originalFilename: string;
  submittedAt: string;
}
