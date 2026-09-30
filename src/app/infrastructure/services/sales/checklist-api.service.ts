import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ChecklistCatalog, ChecklistDetail, ChecklistStatus, ChecklistSubmit, ChecklistSummary,
  ComodatoCandidate, RegisterComodatoItem, RegisterVisualItem,
} from '../../../domain/models/sales/checklist.model';

/** A API do checklist de vendas (`/api/checklists`). */
@Injectable({ providedIn: 'root' })
export class ChecklistApiService {

  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/checklists`;

  /**
   * O catálogo, com o ETag de antes: se nada mudou, a API devolve 304 sem
   * corpo — o Angular trata 304 como erro, e quem chama olha o `status`.
   */
  catalogo(etag: string | null): Observable<HttpResponse<ChecklistCatalog>> {
    const headers = etag ? new HttpHeaders({ 'If-None-Match': etag }) : undefined;
    return this.http.get<ChecklistCatalog>(`${this.base}/catalog`, { headers, observe: 'response' });
  }

  /** Envia ou reenvia. PUT porque o id vem do celular e o mesmo envio pode chegar duas vezes. */
  enviar(id: string, envio: ChecklistSubmit): Observable<ChecklistDetail> {
    return this.http.put<ChecklistDetail>(`${this.base}/${id}`, envio);
  }

  meus(): Observable<ChecklistSummary[]> {
    return this.http.get<ChecklistSummary[]>(`${this.base}/me`);
  }

  todos(status?: ChecklistStatus[]): Observable<ChecklistSummary[]> {
    let params = new HttpParams();
    (status ?? []).forEach(s => (params = params.append('status', s)));
    return this.http.get<ChecklistSummary[]>(this.base, { params });
  }

  detalhe(id: string): Observable<ChecklistDetail> {
    return this.http.get<ChecklistDetail>(`${this.base}/${id}`);
  }

  pedirAlteracao(id: string, motivo: string): Observable<ChecklistDetail> {
    return this.http.post<ChecklistDetail>(`${this.base}/${id}/change-request`, { notes: motivo });
  }

  aprovar(id: string, notas: string | null): Observable<ChecklistDetail> {
    return this.http.post<ChecklistDetail>(`${this.base}/${id}/approve`, { notes: notas });
  }

  devolver(id: string, motivo: string): Observable<ChecklistDetail> {
    return this.http.post<ChecklistDetail>(`${this.base}/${id}/return`, { notes: motivo });
  }

  liberarAlteracao(id: string, notas: string | null): Observable<ChecklistDetail> {
    return this.http.post<ChecklistDetail>(`${this.base}/${id}/grant-change`, { notes: notas });
  }

  negarAlteracao(id: string, motivo: string): Observable<ChecklistDetail> {
    return this.http.post<ChecklistDetail>(`${this.base}/${id}/deny-change`, { notes: motivo });
  }

  pdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }

  // ── Cadastros (Controladoria) ────────────────────────────────────────────

  itensVisuais(): Observable<RegisterVisualItem[]> {
    return this.http.get<RegisterVisualItem[]>(`${this.base}/registers/visual-items`);
  }

  criarItemVisual(item: Omit<RegisterVisualItem, 'id'>): Observable<RegisterVisualItem> {
    return this.http.post<RegisterVisualItem>(`${this.base}/registers/visual-items`, item);
  }

  alterarItemVisual(id: string, item: Omit<RegisterVisualItem, 'id'>): Observable<RegisterVisualItem> {
    return this.http.put<RegisterVisualItem>(`${this.base}/registers/visual-items/${id}`, item);
  }

  itensComodato(): Observable<RegisterComodatoItem[]> {
    return this.http.get<RegisterComodatoItem[]>(`${this.base}/registers/comodato-items`);
  }

  candidatosComodato(): Observable<ComodatoCandidate[]> {
    return this.http.get<ComodatoCandidate[]>(`${this.base}/registers/comodato-candidates`);
  }

  criarItemComodato(item: { productCode: number; popularName: string | null; sortOrder: number; active: boolean }): Observable<RegisterComodatoItem> {
    return this.http.post<RegisterComodatoItem>(`${this.base}/registers/comodato-items`, item);
  }

  alterarItemComodato(id: string, item: { productCode: number; popularName: string | null; sortOrder: number; active: boolean }): Observable<RegisterComodatoItem> {
    return this.http.put<RegisterComodatoItem>(`${this.base}/registers/comodato-items/${id}`, item);
  }
}
