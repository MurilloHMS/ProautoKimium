import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  GuideLayoutCatalog, GuideLayoutDocument, GuideLayoutState, GuideLayoutVersion, GuideLayoutVersionSummary,
} from '../../domain/models/guide-layout.model';

/**
 * O layout do Guia de Utilização. Escrever exige `company/guide:CONFIGURAR`
 * (o Design); ler, qualquer permissão da tela.
 */
@Injectable({ providedIn: 'root' })
export class GuideLayoutService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v1/reports/guide`;

  state(): Observable<GuideLayoutState> {
    return this.http.get<GuideLayoutState>(`${this.base}/layout`);
  }

  catalog(): Observable<GuideLayoutCatalog> {
    return this.http.get<GuideLayoutCatalog>(`${this.base}/layout/catalog`);
  }

  saveDraft(document: GuideLayoutDocument): Observable<GuideLayoutVersion> {
    return this.http.put<GuideLayoutVersion>(`${this.base}/layout/draft`, { document });
  }

  discardDraft(): Observable<void> {
    return this.http.delete<void>(`${this.base}/layout/draft`);
  }

  publish(note: string | null): Observable<GuideLayoutVersion> {
    return this.http.post<GuideLayoutVersion>(`${this.base}/layout/publish`, { note });
  }

  versions(): Observable<GuideLayoutVersionSummary[]> {
    return this.http.get<GuideLayoutVersionSummary[]>(`${this.base}/layout/versions`);
  }

  restore(id: string): Observable<GuideLayoutVersion> {
    return this.http.post<GuideLayoutVersion>(`${this.base}/layout/versions/${id}/restore`, {});
  }

  /** O PDF do layout que está na tela — salvo ou não —, com produtos de exemplo. */
  preview(document: GuideLayoutDocument, productIds: string[], title: string): Observable<Blob> {
    return this.http.post(`${this.base}/layout/preview`, { document, productIds, title }, { responseType: 'blob' });
  }

  uploadImage(file: File): Observable<{ id: string; width: number; height: number }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ id: string; width: number; height: number }>(`${this.base}/layout/images`, form);
  }

  /** Blob, e não URL: a rota exige token, e `<img src>` não manda token. */
  image(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/layout/images/${id}`, { responseType: 'blob' });
  }

  /**
   * O guia de Contratos, sempre com o layout publicado. `inline` pede para
   * mostrar na prévia em vez de baixar.
   */
  generate(title: string, productIds: string[], customerLogo: File | null, inline: boolean): Observable<Blob> {
    const form = new FormData();
    form.append('request', new Blob([JSON.stringify({ tituloGuia: title, productIds })], { type: 'application/json' }));
    if (customerLogo) form.append('logoCliente', customerLogo);
    return this.http.post(`${this.base}${inline ? '?inline=true' : ''}`, form, { responseType: 'blob' });
  }
}
