import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Audience,
  DocumentRequest,
  Recipient,
  RequestFile,
  UpdateDocumentRequest,
} from '../../../domain/models/hr/document-request.model';
import { AudienceOptions } from '../../../domain/models/events.model';

/**
 * Solicitações do RH. Duas portas na mesma API:
 * - RH (`rh/document-requests`): criar, editar, enviar, acompanhar, conferir;
 * - funcionário (`documentos/rh/requests`): as rotas `/me`, onde quem responde vem do login.
 */
@Injectable({ providedIn: 'root' })
export class DocumentRequestService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/hr/document-requests`;

  // ── RH ──
  list(): Observable<DocumentRequest[]> {
    return this.http.get<DocumentRequest[]>(this.url);
  }

  get(id: string): Observable<DocumentRequest> {
    return this.http.get<DocumentRequest>(`${this.url}/${id}`);
  }

  create(title: string): Observable<DocumentRequest> {
    return this.http.post<DocumentRequest>(this.url, { title });
  }

  update(id: string, body: UpdateDocumentRequest): Observable<DocumentRequest> {
    return this.http.put<DocumentRequest>(`${this.url}/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  duplicate(id: string): Observable<DocumentRequest> {
    return this.http.post<DocumentRequest>(`${this.url}/${id}/duplicate`, {});
  }

  uploadTemplate(id: string, file: File): Observable<DocumentRequest> {
    const data = new FormData();
    data.append('file', file);
    return this.http.post<DocumentRequest>(`${this.url}/${id}/template`, data);
  }

  send(id: string, audience: Audience): Observable<DocumentRequest> {
    return this.http.post<DocumentRequest>(`${this.url}/${id}/send`, audience);
  }

  addRecipients(id: string, audience: Audience): Observable<DocumentRequest> {
    return this.http.post<DocumentRequest>(`${this.url}/${id}/recipients`, audience);
  }

  remind(id: string): Observable<{ reminded: number }> {
    return this.http.post<{ reminded: number }>(`${this.url}/${id}/remind`, {});
  }

  close(id: string): Observable<DocumentRequest> {
    return this.http.post<DocumentRequest>(`${this.url}/${id}/close`, {});
  }

  audienceOptions(): Observable<AudienceOptions> {
    return this.http.get<AudienceOptions>(`${this.url}/audience-options`);
  }

  recipients(id: string): Observable<Recipient[]> {
    return this.http.get<Recipient[]>(`${this.url}/${id}/recipients`);
  }

  /** O que espera conferência, de todas as solicitações: a aba da Pendências. */
  awaitingReview(): Observable<Recipient[]> {
    return this.http.get<Recipient[]>(`${this.url}/recipients/awaiting-review`);
  }

  approve(recipientId: string): Observable<Recipient> {
    return this.http.post<Recipient>(`${this.url}/recipients/${recipientId}/approve`, {});
  }

  giveBack(recipientId: string, reason: string): Observable<Recipient> {
    return this.http.post<Recipient>(`${this.url}/recipients/${recipientId}/return`, { reason });
  }

  // ── Funcionário ──
  mine(): Observable<Recipient[]> {
    return this.http.get<Recipient[]>(`${this.url}/me`);
  }

  uploadFile(recipientId: string, fieldKey: string, file: File): Observable<RequestFile> {
    const data = new FormData();
    data.append('fieldKey', fieldKey);
    data.append('file', file);
    return this.http.post<RequestFile>(`${this.url}/me/${recipientId}/files`, data);
  }

  submit(recipientId: string, answers: Record<string, unknown>): Observable<Recipient> {
    return this.http.post<Recipient>(`${this.url}/me/${recipientId}/submit`, { answers });
  }

  // ── Os dois ──
  downloadFile(fileId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/files/${fileId}`, { observe: 'response', responseType: 'blob' });
  }

  downloadTemplate(requestId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/${requestId}/template`, { observe: 'response', responseType: 'blob' });
  }
}
