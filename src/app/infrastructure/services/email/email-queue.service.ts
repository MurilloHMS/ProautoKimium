import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EmailDetail,
  EmailListQuery,
  EmailPage,
  EmailRow,
  EmailSummary,
  PeriodDays,
} from '../../../domain/models/email/email-queue.model';

/** Fila de e-mails (tela do desenvolvedor, `dev/email-queue`). */
@Injectable({ providedIn: 'root' })
export class EmailQueueService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dev/email-queue`;

  list(query: EmailListQuery): Observable<EmailPage> {
    let params = new HttpParams()
      .set('days', query.days)
      .set('page', query.page)
      .set('size', query.size);
    if (query.status) params = params.set('status', query.status);
    if (query.origin) params = params.set('origin', query.origin);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    return this.http.get<EmailPage>(this.url, { params });
  }

  summary(days: PeriodDays): Observable<EmailSummary> {
    return this.http.get<EmailSummary>(`${this.url}/summary`, { params: { days } });
  }

  get(id: string): Observable<EmailDetail> {
    return this.http.get<EmailDetail>(`${this.url}/${id}`);
  }

  resend(id: string): Observable<EmailRow> {
    return this.http.post<EmailRow>(`${this.url}/${id}/resend`, {});
  }

  resendMany(ids: string[]): Observable<{ requeued: number }> {
    return this.http.post<{ requeued: number }>(`${this.url}/resend`, { ids });
  }
}
