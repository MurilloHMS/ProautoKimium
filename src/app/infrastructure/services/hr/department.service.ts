import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateDepartmentRequest, Department } from '../../../domain/models/hr/org-structure.model';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {

  constructor(private http: HttpClient) {}

  getAll(): Observable<Department[]> {
    return this.http.get<Department[]>(`${environment.apiUrl}/hr/departments`);
  }

  create(request: CreateDepartmentRequest): Observable<Department> {
    return this.http.post<Department>(`${environment.apiUrl}/hr/departments`, request);
  }

  update(id: string, request: CreateDepartmentRequest): Observable<Department> {
    return this.http.put<Department>(`${environment.apiUrl}/hr/departments/${id}`, request);
  }

  /**
   * A API recusa com **409** quando o cadastro esta em uso, e a mensagem dela
   * diz por quem. Quem chama repassa essa frase — inventar um texto generico
   * aqui esconderia justamente o que a pessoa precisa saber para resolver.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/hr/departments/${id}`);
  }
}
