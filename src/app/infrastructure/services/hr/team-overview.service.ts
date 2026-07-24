import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TeamOverviewEntry } from '../../../domain/models/hr/team-overview.model';

@Injectable({
  providedIn: 'root'
})
export class TeamOverviewService {

  constructor(private http: HttpClient) {}

  getOverview(teamId?: string, companyId?: string): Observable<TeamOverviewEntry[]> {
    const params: Record<string, string> = {};
    if (teamId) params['teamId'] = teamId;
    if (companyId) params['companyId'] = companyId;

    return this.http.get<TeamOverviewEntry[]>(`${environment.apiUrl}/hr/team-overview`, { params });
  }
}
