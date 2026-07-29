import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CareerHistoryResponse, CreateCareerHistoryRequest } from '../../../domain/models/hr/career.model';

@Injectable({
  providedIn: 'root'
})
export class CareerHistoryService {

  constructor(private http: HttpClient) {}

  listByEmployee(employeeId: string): Observable<CareerHistoryResponse[]> {
    return this.http.get<CareerHistoryResponse[]>(`${environment.apiUrl}/hr/career-histories`, {
      params: { employeeId }
    });
  }

  create(request: CreateCareerHistoryRequest): Observable<CareerHistoryResponse> {
    return this.http.post<CareerHistoryResponse>(`${environment.apiUrl}/hr/career-histories`, request);
  }
}
