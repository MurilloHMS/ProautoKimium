import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Company, CreateCompanyRequest } from '../../../domain/models/hr/org-structure.model';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {

  constructor(private http: HttpClient) {}

  getAll(): Observable<Company[]> {
    return this.http.get<Company[]>(`${environment.apiUrl}/hr/companies`);
  }

  create(request: CreateCompanyRequest): Observable<Company> {
    return this.http.post<Company>(`${environment.apiUrl}/hr/companies`, request);
  }
}
