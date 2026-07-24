import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SendNotificationPayload, SendNotificationResult } from '../../../domain/models/hr/employee-notification.model';

@Injectable({
  providedIn: 'root'
})
export class EmployeeNotificationService {

  constructor(private http: HttpClient) {}

  send(payload: SendNotificationPayload): Observable<SendNotificationResult> {
    return this.http.post<SendNotificationResult>(`${environment.apiUrl}/hr/notifications`, payload);
  }
}
