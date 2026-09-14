import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  EventDetail, EventRequest, EventSummary, Speaker, SpeakerRequest, TalkRequest,
} from '../../../domain/models/events.model';

/** `/api/events` e `/api/speakers`. */
@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/events`;
  private readonly speakersBase = `${environment.apiUrl}/speakers`;

  // ── Documentos (só publicados) ─────────────────────────────────────────────

  listPublished(): Observable<EventSummary[]> {
    return this.http.get<EventSummary[]>(this.base);
  }

  /** Rascunho responde 404 para quem só vê; abre para quem cadastra. */
  get(id: string): Observable<EventDetail> {
    return this.http.get<EventDetail>(`${this.base}/${id}`);
  }

  // ── Cadastro ───────────────────────────────────────────────────────────────

  listForManagement(): Observable<EventSummary[]> {
    return this.http.get<EventSummary[]>(`${this.base}/manage`);
  }

  create(data: EventRequest, cover: File | null): Observable<EventDetail> {
    return this.http.post<EventDetail>(this.base, this.multipart(data, 'cover', cover));
  }

  update(id: string, data: EventRequest, cover: File | null): Observable<EventDetail> {
    return this.http.put<EventDetail>(`${this.base}/${id}`, this.multipart(data, 'cover', cover));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  publish(id: string): Observable<EventDetail> {
    return this.http.post<EventDetail>(`${this.base}/${id}/publish`, null);
  }

  unpublish(id: string): Observable<EventDetail> {
    return this.http.post<EventDetail>(`${this.base}/${id}/unpublish`, null);
  }

  addTalk(eventId: string, data: TalkRequest): Observable<EventDetail> {
    return this.http.post<EventDetail>(`${this.base}/${eventId}/talks`, data);
  }

  updateTalk(eventId: string, talkId: string, data: TalkRequest): Observable<EventDetail> {
    return this.http.put<EventDetail>(`${this.base}/${eventId}/talks/${talkId}`, data);
  }

  deleteTalk(eventId: string, talkId: string): Observable<EventDetail> {
    return this.http.delete<EventDetail>(`${this.base}/${eventId}/talks/${talkId}`);
  }

  listSpeakers(): Observable<Speaker[]> {
    return this.http.get<Speaker[]>(this.speakersBase);
  }

  createSpeaker(data: SpeakerRequest, photo: File | null): Observable<Speaker> {
    return this.http.post<Speaker>(this.speakersBase, this.multipart(data, 'photo', photo));
  }

  updateSpeaker(id: string, data: SpeakerRequest, photo: File | null): Observable<Speaker> {
    return this.http.put<Speaker>(`${this.speakersBase}/${id}`, this.multipart(data, 'photo', photo));
  }

  deleteSpeaker(id: string): Observable<void> {
    return this.http.delete<void>(`${this.speakersBase}/${id}`);
  }

  /** O JSON vai como parte `data` com tipo próprio: o `@RequestPart` da API exige. */
  private multipart(data: unknown, nomeArquivo: string, arquivo: File | null): FormData {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (arquivo) form.append(nomeArquivo, arquivo, arquivo.name);
    return form;
  }
}
