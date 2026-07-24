import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeVacationOverview, VacationRequest } from '../../../domain/models/hr/vacation-request.model';

export interface CreateVacationRequestPayload {
  startDate: string;
  endDate: string;
  replacementEmployeeId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class VacationRequestService {

  constructor(private http: HttpClient) {}

  getMyOverview(): Observable<EmployeeVacationOverview> {
    return this.http.get<EmployeeVacationOverview>(`${environment.apiUrl}/hr/vacation-requests/me`);
  }

  request(payload: CreateVacationRequestPayload): Observable<VacationRequest> {
    return this.http.post<VacationRequest>(`${environment.apiUrl}/hr/vacation-requests`, payload);
  }
}
