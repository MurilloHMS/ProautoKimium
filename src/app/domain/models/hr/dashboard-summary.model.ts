export interface CompanyEmployeeCount {
  companyName: string;
  total: number;
  clt: number;
  pj: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface OrgStructureSummary {
  companies: number;
  departments: number;
  teams: number;
  positions: number;
}

export interface HrDashboardSummary {
  employeesByCompany: CompanyEmployeeCount[];
  employeesByPosition: NameCount[];
  employeesByDepartment: NameCount[];
  totalSalaries: number;
  orgStructure: OrgStructureSummary;
}
