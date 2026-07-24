import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Reimbursement } from '../../../domain/models/hr/reimbursement.model';

export interface RequestReimbursementPayload {
  expenseDate: string;
  amount: number;
  category: string;
  reason: string;
  receipt: File;
}

@Injectable({
  providedIn: 'root'
})
export class ReimbursementService {

  constructor(private http: HttpClient) {}

  getMine(): Observable<Reimbursement[]> {
    return this.http.get<Reimbursement[]>(`${environment.apiUrl}/hr/reimbursements/me`);
  }

  request(payload: RequestReimbursementPayload): Observable<Reimbursement> {
    const formData = new FormData();
    formData.append('expenseDate', payload.expenseDate);
    formData.append('amount', String(payload.amount));
    formData.append('category', payload.category);
    formData.append('reason', payload.reason);
    formData.append('receipt', payload.receipt);

    return this.http.post<Reimbursement>(`${environment.apiUrl}/hr/reimbursements`, formData);
  }

  downloadReceipt(id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/hr/reimbursements/${id}/receipt`, {
      responseType: 'blob'
    });
  }
}
