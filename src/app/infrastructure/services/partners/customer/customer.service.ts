import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer, CustomerResponse } from '../../../../domain/models/customer.model';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(private http: HttpClient) { }

  getCustomers() : Observable<CustomerResponse[]>{
    return this.http.get<CustomerResponse[]>(`${environment.apiUrl}/customer`);
  }

  addCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${environment.apiUrl}/customer`, customer);
  }

  updateCustomer(customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(`${environment.apiUrl}/customer`, customer);
  }
}
