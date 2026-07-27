import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BulkFuelRequest,
  BulkFuelResponse,
  BulkTransportVoucherRequest,
  BulkTransportVoucherResponse,
  CltPjComparisonResult,
  FuelRequest,
  FuelResult,
  MealVoucherRequest,
  MealVoucherResult,
  TicketPriceAdjustmentRequest,
  TicketPriceAdjustmentResponse,
  TransportationVoucherRequest,
  TransportationVoucherResult,
} from '../../../domain/models/hr/calculator.model';

@Injectable({
  providedIn: 'root'
})
export class PayrollCalculatorService {

  constructor(private http: HttpClient) {}

  calculateTransportationVoucher(request: TransportationVoucherRequest): Observable<TransportationVoucherResult> {
    return this.http.post<TransportationVoucherResult>(`${environment.apiUrl}/hr/calculators/transportation-voucher`, request);
  }

  calculateMealVoucher(request: MealVoucherRequest): Observable<MealVoucherResult> {
    return this.http.post<MealVoucherResult>(`${environment.apiUrl}/hr/calculators/meal-voucher`, request);
  }

  calculateFuel(request: FuelRequest): Observable<FuelResult> {
    return this.http.post<FuelResult>(`${environment.apiUrl}/hr/calculators/fuel`, request);
  }

  compareCltPj(employeeId: string): Observable<CltPjComparisonResult> {
    return this.http.get<CltPjComparisonResult>(`${environment.apiUrl}/hr/calculators/clt-pj/${employeeId}`);
  }

  calculateBulkTransportVoucher(request: BulkTransportVoucherRequest): Observable<BulkTransportVoucherResponse[]> {
    return this.http.post<BulkTransportVoucherResponse[]>(`${environment.apiUrl}/hr/calculators/bulk/transportation-voucher`, request);
  }

  calculateBulkFuel(request: BulkFuelRequest): Observable<BulkFuelResponse[]> {
    return this.http.post<BulkFuelResponse[]>(`${environment.apiUrl}/hr/calculators/bulk/fuel`, request);
  }

  adjustTicketPrices(request: TicketPriceAdjustmentRequest): Observable<TicketPriceAdjustmentResponse> {
    return this.http.put<TicketPriceAdjustmentResponse>(`${environment.apiUrl}/hr/calculators/ticket-price-adjustment`, request);
  }
}
