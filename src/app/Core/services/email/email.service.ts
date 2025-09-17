import { Injectable } from '@angular/core';
import { Email, EmailItem } from '../../../domain/models/email.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({providedIn: 'root'})
export class EmailService {

  constructor(private http: HttpClient) { }

  getEmails() : Observable<EmailItem[]>{
    return this.http.get<EmailItem[]>(`${environment.apiUrl}/email`);
  }
}
