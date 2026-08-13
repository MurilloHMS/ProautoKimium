import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ClientUser, Customer } from '../../../../domain/models/customer.model';
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

  /** Quem entra no portal por este cliente. */
  getAccess(codParceiro: string): Observable<ClientUser[]> {
    return this.http.get<ClientUser[]>(`${environment.apiUrl}/customer/${codParceiro}/users`);
  }

  /**
   * Liga uma pessoa a um cliente. A API acrescenta a role CLIENTE junto — sem
   * ela o portal recusa e a pessoa entra numa tela vazia.
   */
  linkUser(login: string, codParceiro: string): Observable<unknown> {
    return this.http.put(`${environment.apiUrl}/auth/users/${login}/customer`, null, {
      params: { codParceiro },
    });
  }

  /** Tira o acesso sem apagar o usuário: ele continua existindo, sem portal. */
  unlinkUser(login: string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/auth/users/${login}/customer`);
  }

  importCustomersByExcel(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${environment.apiUrl}/customer/upload`, formData, {responseType: 'text'});
  }
}
