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

// --- Bulk Transport Voucher ---

export interface BulkTransportVoucherRequest {
  transportType: 'MUNICIPAL_BUS' | 'INTERMUNICIPAL_BUS';
  workingDays: number;
}

export interface BulkTransportVoucherResultItem {
  employeeId: string;
  employeeName: string;
  document: string;
  dailyTicketCount: number;
  ticketPrice: number;
  workingDays: number;
  totalAmount: number;
}

export interface BulkTransportVoucherResponse {
  companyName: string;
  companyId: string;
  employees: BulkTransportVoucherResultItem[];
  grandTotal: number;
}

// --- Bulk Fuel ---

export interface BulkFuelRequest {
  fuelPricePerLiter: number;
  workingDays: number;
}

export interface BulkFuelResultItem {
  employeeId: string;
  employeeName: string;
  document: string;
  dailyDistanceKm: number;
  vehicleKmPerLiter: number;
  litersNeeded: number;
  totalAmount: number;
}

export interface BulkFuelResponse {
  companyName: string;
  companyId: string;
  employees: BulkFuelResultItem[];
  grandTotal: number;
}

// --- Ticket Price Adjustment ---

export interface TicketPriceAdjustmentRequest {
  transportType: 'MUNICIPAL_BUS' | 'INTERMUNICIPAL_BUS';
  newTicketPrice: number;
}

export interface TicketPriceAdjustmentResponse {
  affectedCount: number;
  transportType: string;
  newTicketPrice: number;
}
