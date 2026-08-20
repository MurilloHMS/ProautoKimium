import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  Holerite,
  HoleriteAuditoria,
  HoleritePreviewItem,
  HoleriteTipo,
  PdfUploadResponse,
  VincularHoleriteResult,
} from '../../../domain/models/hr/holerite.model';

/**
 * Holerites: conferência, envio, e a separação avulsa em PDFs.
 *
 * As três telas chamavam `HttpClient` direto, cada uma com a sua cópia dos
 * DTOs. Aqui as rotas ficam num lugar só.
 */
@Injectable({ providedIn: 'root' })
export class HoleriteService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/holerite`;
  private readonly pdfUrl = `${environment.apiUrl}/pdf`;

  /**
   * Analisa o PDF e diz o que aconteceria, sem gravar nada.
   *
   * O arquivo é reenviado no envio de verdade, e isso é de propósito: entre
   * conferir e enviar, o RH cadastra quem faltava, e o resultado precisa ser
   * recalculado com o cadastro novo.
   */
  preview(file: File, competencia: string, tipo: HoleriteTipo): Observable<HoleritePreviewItem[]> {
    return this.http.post<HoleritePreviewItem[]>(`${this.url}/vincular/preview`,
      this.form(file, competencia, tipo));
  }

  vincular(file: File, competencia: string, tipo: HoleriteTipo): Observable<VincularHoleriteResult> {
    return this.http.post<VincularHoleriteResult>(`${this.url}/vincular`,
      this.form(file, competencia, tipo));
  }

  /** Holerites do próprio usuário logado. */
  meus(): Observable<Holerite[]> {
    return this.http.get<Holerite[]>(`${this.url}/me`);
  }

  // ─── Auditoria (RH) ──────────────────────────────────────────────────────

  auditoria(competencia: string, tipo: HoleriteTipo): Observable<HoleriteAuditoria[]> {
    return this.http.get<HoleriteAuditoria[]>(`${this.url}/auditoria`, {
      params: { competencia, tipo },
    });
  }

  /** Cancela sem apagar: o registro fica na auditoria e some da tela da pessoa. */
  cancelar(id: string, motivo: string): Observable<string> {
    return this.http.put(`${this.url}/${id}/cancelar`, { motivo }, { responseType: 'text' });
  }

  /** Troca o PDF de um holerite já enviado. Zera abriu e confirmou. */
  substituirArquivo(id: string, file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put(`${this.url}/${id}/arquivo`, form, { responseType: 'text' });
  }

  /** Só o dono confirma — a API recusa qualquer outro. */
  confirmarRecebimento(id: string): Observable<string> {
    return this.http.post(`${this.url}/${id}/confirmar`, null, { responseType: 'text' });
  }

  baixar(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/arquivo`, { responseType: 'blob' });
  }

  // ─── Separação avulsa: fatia o PDF e devolve um ZIP, sem vincular ─────────

  separarPdf(file: File): Observable<PdfUploadResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<PdfUploadResponse>(`${this.pdfUrl}/upload`, form);
  }

  /** `observe: 'response'` porque o nome do arquivo vem no Content-Disposition. */
  baixarZip(uploadId: string, pages: { name: string }[]): Observable<HttpResponse<Blob>> {
    return this.http.post(`${this.pdfUrl}/save/${uploadId}`, pages, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  private form(file: File, competencia: string, tipo: HoleriteTipo): FormData {
    const form = new FormData();
    form.append('file', file);
    form.append('competencia', competencia);
    form.append('tipo', tipo);
    return form;
  }
}
