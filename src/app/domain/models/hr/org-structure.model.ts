export interface Company {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
}

export interface CreateCompanyRequest {
  name: string;
  legalName: string;
  cnpj: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface CreateDepartmentRequest {
  name: string;
}

export interface Team {
  id: string;
  name: string;
  department: Department;
}

export interface CreateTeamRequest {
  name: string;
  departmentId: string;
}

export interface Hierarchy {
  id: string;
  name: string;
  levelOrder: number;
}

export interface CreateHierarchyRequest {
  name: string;
  levelOrder: number;
}
