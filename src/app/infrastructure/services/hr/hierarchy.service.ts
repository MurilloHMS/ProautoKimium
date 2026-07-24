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
}
