import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer } from '../../../../domain/models/customer.model';
import { environment } from '../../../../../environments/environment';
import {Recipient} from "../../../../domain/models/partnerRecipient.model";

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(private http: HttpClient) { }

  getCustomers() : Observable<Customer[]>{
    return this.http.get<Customer[]>(`${environment.apiUrl}/customer`);
  }

  getCustomersEmail() : Observable<Recipient[]>{
    return this.http.get<Recipient[]>(`${environment.apiUrl}/customer/only-email`);
  }

  addCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${environment.apiUrl}/customer`, customer);
  }

  updateCustomer(customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(`${environment.apiUrl}/customer`, customer);
  }

  importCustomersByExcel(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${environment.apiUrl}/customer/upload`, formData, {responseType: 'text'});
  }
}
