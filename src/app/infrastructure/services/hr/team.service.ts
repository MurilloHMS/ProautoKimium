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

  update(id: string, request: CreateTeamRequest): Observable<Team> {
    return this.http.put<Team>(`${environment.apiUrl}/hr/teams/${id}`, request);
  }

  /**
   * A API recusa com **409** quando o cadastro esta em uso, e a mensagem dela
   * diz por quem. Quem chama repassa essa frase — inventar um texto generico
   * aqui esconderia justamente o que a pessoa precisa saber para resolver.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/hr/teams/${id}`);
  }
}
