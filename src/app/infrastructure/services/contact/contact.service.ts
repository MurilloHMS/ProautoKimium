import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Contact } from '../../../domain/models/contact.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  constructor(private http: HttpClient) { }

  getContacts() : Observable<Contact[]>{
    return this.http.get<Contact[]>(`${environment.apiUrl}/contact`);
  }

  addContact(contact: Contact): Observable<Contact> {
    return this.http.post<Contact>(`${environment.apiUrl}/contact`, contact);
  }
}
