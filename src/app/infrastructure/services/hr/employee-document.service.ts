import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeDocument } from '../../../domain/models/hr/employee-document.model';

@Injectable({
  providedIn: 'root'
})
export class EmployeeDocumentService {

  constructor(private http: HttpClient) {}

  getMine(): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${environment.apiUrl}/hr/employee-documents/me`);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/hr/employee-documents/${id}/arquivo`, {
      responseType: 'blob'
    });
  }
}
