import { Employee } from './../../../../domain/models/employee.model';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { empty, Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {Recipient} from "../../../../domain/models/partnerRecipient.model";

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {

  constructor(private http: HttpClient){}

  getEmployes() : Observable<Employee[]>{
    return this.http.get<Employee[]>(`${environment.apiUrl}/employee`);
  }

  getEmployeeEmail() : Observable<Recipient[]>{
    return this.http.get<Recipient[]>(`${environment.apiUrl}/employee/only-email`);
  }

  addEmploye(employe: Employee): Observable<any> {
    return this.http.post(`${environment.apiUrl}/employee`, employe, {
      responseType: 'text'
    });
  }

  updateEmploye(employee: Employee): Observable<any> {
    return this.http.put(`${environment.apiUrl}/employee`, employee, {
      responseType: 'text'
    });
  }
}
