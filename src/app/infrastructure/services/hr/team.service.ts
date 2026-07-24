import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateTeamRequest, Team } from '../../../domain/models/hr/org-structure.model';

@Injectable({
  providedIn: 'root'
})
export class TeamService {

  constructor(private http: HttpClient) {}

  getAll(): Observable<Team[]> {
    return this.http.get<Team[]>(`${environment.apiUrl}/hr/teams`);
  }

  create(request: CreateTeamRequest): Observable<Team> {
    return this.http.post<Team>(`${environment.apiUrl}/hr/teams`, request);
  }
}
