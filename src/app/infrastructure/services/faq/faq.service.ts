import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FaqPublicResponseDTO, FaqResponseDTO } from '../../../domain/models/faq.model';

@Injectable({
  providedIn: 'root',
})
export class FaqService {
  private readonly base = `${environment.apiUrl}/faq`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<FaqResponseDTO[]> {
    return this.http.get<FaqResponseDTO[]>(this.base);
  }

  getAllPublic(): Observable<FaqPublicResponseDTO[]> {
    return this.http.get<FaqPublicResponseDTO[]>(`${this.base}/public`);
  }

  create(dto: { title: string; body: string }): Observable<void> {
    return this.http.post(`${this.base}`, dto, { responseType: 'text' }).pipe(map(() => void 0));
  }

  update(id: string, dto: { title: string; body: string }): Observable<void> {
    return this.http.put(`${this.base}/${id}`, dto, { responseType: 'text' }).pipe(map(() => void 0));
  }

  publish(id: string): Observable<void> {
    return this.http.put(`${this.base}/${id}/publicar`, {}, { responseType: 'text' }).pipe(map(() => void 0));
  }

  archive(id: string): Observable<void> {
    return this.http.put(`${this.base}/${id}/arquivar`, {}, { responseType: 'text' }).pipe(map(() => void 0));
  }

  setDraft(id: string): Observable<void> {
    return this.http.put(`${this.base}/${id}/rascunho`, {}, { responseType: 'text' }).pipe(map(() => void 0));
  }
}
