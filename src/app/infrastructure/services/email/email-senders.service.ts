import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmailOrigin, Sender, SenderRoute } from '../../../domain/models/email/email-queue.model';

/** Remetentes e "quem envia o quê" (tela do desenvolvedor, `dev/email-senders`). */
@Injectable({ providedIn: 'root' })
export class EmailSendersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dev/email-senders`;

  list(): Observable<Sender[]> {
    return this.http.get<Sender[]>(this.url);
  }

  create(name: string, displayName: string): Observable<Sender> {
    return this.http.post<Sender>(this.url, { name, displayName });
  }

  update(id: string, body: { displayName?: string; active?: boolean }): Observable<Sender> {
    return this.http.patch<Sender>(`${this.url}/${id}`, body);
  }

  makeDefault(id: string): Observable<Sender> {
    return this.http.put<Sender>(`${this.url}/${id}/default`, {});
  }

  routes(): Observable<SenderRoute[]> {
    return this.http.get<SenderRoute[]>(`${this.url}/routes`);
  }

  updateRoute(origin: EmailOrigin, senderId: string | null, replyToId: string | null): Observable<SenderRoute> {
    return this.http.put<SenderRoute>(`${this.url}/routes/${origin}`, { senderId, replyToId });
  }
}
