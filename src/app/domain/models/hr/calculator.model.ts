export interface TransportationVoucherRequest {
  employeeId: string;
  fareValue: number;
  workingDays: number;
}

export interface TransportationVoucherResult {
  employeeId: string;
  employeeName: string;
  dailyCommutesCount: number;
  fareValue: number;
  workingDays: number;
  totalAmount: number;
}

export interface MealVoucherRequest {
  employeeId: string;
  mealValue: number;
  workingDays: number;
}

export interface MealVoucherResult {
  employeeId: string;
  employeeName: string;
  dailyMealsCount: number;
  mealValue: number;
  workingDays: number;
  totalAmount: number;
}

export interface FuelRequest {
  employeeId: string;
  distanceKm: number;
  vehicleConsumptionKmPerLiter: number;
  literPrice: number;
}

export interface FuelResult {
  employeeId: string;
  employeeName: string;
  distanceKm: number;
  litersNeeded: number;
  literPrice: number;
  totalAmount: number;
}

export interface CltPjComparisonResult {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  inssPatronal: number;
  fgts: number;
  thirteenthSalaryProvision: number;
  vacationProvision: number;
  totalCltCost: number;
  pjEquivalentValue: number;
}
