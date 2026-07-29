export interface Position {
  id: string;
  name: string;
}

export interface CreatePositionRequest {
  name: string;
}

export type SalaryAdjustmentType = 'FIXED' | 'PERCENTAGE';

export interface PositionLevel {
  id: string;
  name: string;
  levelOrder: number;
  positionId: string;
  adjustmentType: SalaryAdjustmentType;
  fixedAmount: number | null;
  percentageIncrease: number | null;
  resolvedSalary: number;
}

export interface CreatePositionLevelRequest {
  name: string;
  levelOrder: number;
  positionId: string;
  adjustmentType: SalaryAdjustmentType;
  fixedAmount: number | null;
  percentageIncrease: number | null;
}

export type CareerChangeReason = 'HIRING' | 'PROMOTION' | 'POSITION_CHANGE' | 'COLLECTIVE_BARGAINING_ADJUSTMENT' | 'PJ_TRANSITION' | 'TERMINATION';
export type ContractType = 'CLT' | 'PJ';

export interface CreateCareerHistoryRequest {
  employeeId: string;
  positionId: string;
  positionLevelId: string;
  contractType: ContractType;
  reason: CareerChangeReason;
  effectiveDate: string;
  notes?: string;
}

export interface CareerHistoryResponse {
  id: string;
  employeeId: string;
  positionId: string;
  positionLevelId: string;
  salary: number;
  contractType: ContractType;
  reason: CareerChangeReason;
  effectiveDate: string;
  notes?: string;
}

export type AdjustmentScope = 'ALL_POSITIONS' | 'SPECIFIC_POSITION';

export interface ApplyCollectiveBargainingAdjustmentRequest {
  percentage: number;
  effectiveDate: string;
  scope: AdjustmentScope;
  positionId: string | null;
}

export interface CollectiveBargainingAdjustmentResult {
  id: string;
  percentage: number;
  effectiveDate: string;
  scope: AdjustmentScope;
  positionId: string | null;
  positionLevelsUpdated: number;
  employeesAffected: number;
}
