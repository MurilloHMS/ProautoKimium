import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HrDashboardSummary } from '../../../domain/models/hr/dashboard-summary.model';

@Injectable({
  providedIn: 'root'
})
export class HrDashboardService {

  constructor(private http: HttpClient) {}

  getSummary(): Observable<HrDashboardSummary> {
    return this.http.get<HrDashboardSummary>(`${environment.apiUrl}/hr/dashboard-summary`);
  }
}
