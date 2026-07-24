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
}
