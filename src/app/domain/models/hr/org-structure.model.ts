import { Address } from '../address.model';

export interface Company {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
  /** Opcional. É de onde os eventos lêem o local quando acontecem na empresa. */
  address: Address | null;
}

/** Criar e editar mandam o mesmo corpo. */
export interface CreateCompanyRequest {
  name: string;
  legalName: string;
  cnpj: string;
  address: Address | null;
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
