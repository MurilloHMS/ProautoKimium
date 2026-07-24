export type ContractType = 'CLT' | 'PJ';
export type AvailabilityStatus = 'AVAILABLE' | 'ON_VACATION' | 'VACATION_SCHEDULED';

export interface TeamOverviewEntry {
  employeeId: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
  companyId: string | null;
  companyName: string | null;
  contractType: ContractType | null;
  availabilityStatus: AvailabilityStatus;
}
