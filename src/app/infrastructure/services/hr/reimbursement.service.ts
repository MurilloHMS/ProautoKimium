import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PayReimbursementPayload,
  Reimbursement,
  ReimbursementStatus,
  ReimbursementSummary,
  ReviewReimbursementPayload
} from '../../../domain/models/hr/reimbursement.model';
import { ReimbursementReportFilter, ReportEmailResult } from '../../../domain/models/hr/reimbursement-report.model';

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

  /** `original`: o comprovante de antes da contestação, que a primeira análise viu. */
  downloadReceipt(id: string, original = false): Observable<HttpResponse<Blob>> {
    return this.http.get(`${environment.apiUrl}/hr/reimbursements/${id}/receipt`, {
      params: original ? { original: 'true' } : {},
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** Gerenciador do RH — sem status, lista tudo; com mês (`2026-09`), pela data da despesa. */
  getAll(status?: ReimbursementStatus, month?: string): Observable<Reimbursement[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    if (month) params['month'] = month;
    return this.http.get<Reimbursement[]>(`${environment.apiUrl}/hr/reimbursements`, { params });
  }

  /** Totais do mês para o RH (todos os funcionários). */
  getSummary(month: string): Observable<ReimbursementSummary> {
    return this.http.get<ReimbursementSummary>(`${environment.apiUrl}/hr/reimbursements/summary`, { params: { month } });
  }

  /** Totais do mês do funcionário logado. */
  getMySummary(month: string): Observable<ReimbursementSummary> {
    return this.http.get<ReimbursementSummary>(`${environment.apiUrl}/hr/reimbursements/me/summary`, { params: { month } });
  }

  /** O dono contesta a recusa: comprovante novo e comentário, uma vez, até 30 dias. */
  contest(id: string, comment: string, receipt: File): Observable<Reimbursement> {
    const formData = new FormData();
    formData.append('comment', comment);
    formData.append('receipt', receipt);
    return this.http.post<Reimbursement>(`${environment.apiUrl}/hr/reimbursements/${id}/contest`, formData);
  }

  approve(id: string, payload: ReviewReimbursementPayload): Observable<Reimbursement> {
    return this.http.post<Reimbursement>(`${environment.apiUrl}/hr/reimbursements/${id}/approve`, payload);
  }

  reject(id: string, payload: ReviewReimbursementPayload): Observable<Reimbursement> {
    return this.http.post<Reimbursement>(`${environment.apiUrl}/hr/reimbursements/${id}/reject`, payload);
  }

  pay(id: string, payload: PayReimbursementPayload): Observable<Reimbursement> {
    return this.http.post<Reimbursement>(`${environment.apiUrl}/hr/reimbursements/${id}/pay`, payload);
  }

  /** O comprovante para a diretoria, em PDF. */
  downloadReport(filter: ReimbursementReportFilter): Observable<HttpResponse<Blob>> {
    return this.http.get(`${environment.apiUrl}/hr/reimbursements/report`, {
      params: reportParams(filter),
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** O mesmo PDF, para os e-mails do RH cadastrados. */
  emailReport(filter: ReimbursementReportFilter): Observable<ReportEmailResult> {
    return this.http.post<ReportEmailResult>(`${environment.apiUrl}/hr/reimbursements/report/email`, null, {
      params: reportParams(filter),
    });
  }

  /** Os reembolsos de um funcionário, para a ficha. */
  getByEmployee(employeeId: string): Observable<Reimbursement[]> {
    return this.http.get<Reimbursement[]>(`${environment.apiUrl}/hr/reimbursements/employee/${employeeId}`);
  }
}

/**
 * `status` repetido (`?status=PAID&status=APPROVED`), que é como o Spring
 * monta a lista. Sem funcionário, o parâmetro nem vai: vazio viraria UUID
 * inválido na API.
 */
export function reportParams(filter: ReimbursementReportFilter): HttpParams {
  let params = new HttpParams().set('from', filter.from).set('to', filter.to);
  for (const status of filter.statuses) {
    params = params.append('status', status);
  }
  if (filter.employeeId) {
    params = params.set('employeeId', filter.employeeId);
  }
  return params;

}
