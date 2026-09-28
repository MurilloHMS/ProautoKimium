import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HrReportRecipient } from '../../../domain/models/hr/reimbursement-report.model';

/** Quem recebe os relatórios do RH por e-mail. */
@Injectable({ providedIn: 'root' })
export class HrReportRecipientService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/hr/report-recipients`;

  list(): Observable<HrReportRecipient[]> {
    return this.http.get<HrReportRecipient[]>(this.url);
  }

  add(email: string): Observable<HrReportRecipient> {
    return this.http.post<HrReportRecipient>(this.url, { email });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
