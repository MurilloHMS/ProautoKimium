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
  PeriodQuery,
} from '../../../domain/models/email/email-queue.model';

/** Fila de e-mails (tela do desenvolvedor, `dev/email-queue`). */
@Injectable({ providedIn: 'root' })
export class EmailQueueService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dev/email-queue`;

  list(query: EmailListQuery): Observable<EmailPage> {
    let params = withPeriod(new HttpParams(), query)
      .set('page', query.page)
      .set('size', query.size);
    if (query.status) params = params.set('status', query.status);
    if (query.origin) params = params.set('origin', query.origin);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    return this.http.get<EmailPage>(this.url, { params });
  }

  summary(period: PeriodQuery): Observable<EmailSummary> {
    return this.http.get<EmailSummary>(`${this.url}/summary`, { params: withPeriod(new HttpParams(), period) });
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

/** `since` (uma data) vence `days` na API; manda só um dos dois. */
function withPeriod(params: HttpParams, period: PeriodQuery): HttpParams {
  return period.since ? params.set('since', period.since) : params.set('days', period.days ?? 7);
}
