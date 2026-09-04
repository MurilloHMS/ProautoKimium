import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateHierarchyRequest, Hierarchy } from '../../../domain/models/hr/org-structure.model';

@Injectable({
  providedIn: 'root'
})
export class HierarchyService {

  constructor(private http: HttpClient) {}

  getAll(): Observable<Hierarchy[]> {
    return this.http.get<Hierarchy[]>(`${environment.apiUrl}/hr/hierarchies`);
  }

  create(request: CreateHierarchyRequest): Observable<Hierarchy> {
    return this.http.post<Hierarchy>(`${environment.apiUrl}/hr/hierarchies`, request);
  }

  update(id: string, request: CreateHierarchyRequest): Observable<Hierarchy> {
    return this.http.put<Hierarchy>(`${environment.apiUrl}/hr/hierarchies/${id}`, request);
  }

  /**
   * A API recusa com **409** quando o cadastro esta em uso, e a mensagem dela
   * diz por quem. Quem chama repassa essa frase — inventar um texto generico
   * aqui esconderia justamente o que a pessoa precisa saber para resolver.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/hr/hierarchies/${id}`);
  }
}
