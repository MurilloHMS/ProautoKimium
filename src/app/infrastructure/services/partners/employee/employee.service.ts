import { Employee } from './../../../../domain/models/employee.model';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { empty, Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {

  constructor(private http: HttpClient){}

  getEmployes() : Observable<Employee[]>{
    return this.http.get<Employee[]>(`${environment.apiUrl}/employee`);
  }

  addEmploye(employe: Employee): Observable<Employee>{
    return this.http.post<Employee>(`${environment.apiUrl}/employee`, employe);
  }

  updateEmploye(employee: Employee) : Observable<Employee>{
    return this.http.put<Employee>(`${environment.apiUrl}/employee`, employee)
  }
}
