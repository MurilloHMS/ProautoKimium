import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  CreateTalentBankEntryDTO,
  TalentBankEntryDTO,
  TalentBankFiltros,
  TalentBankSummaryDTO,
  UpdateTalentBankEntryDTO,
} from '../../../../domain/models/talent-bank.model';

/**
 * Os dois lados do banco de talentos: o público, por token, e a aba do RH.
 *
 * Um service só porque é o mesmo recurso, mas os métodos públicos nunca
 * recebem id e os internos nunca recebem token — é a mesma separação que a API
 * faz em dois controllers.
 */
@Injectable({ providedIn: 'root' })
export class TalentBankService {
  private readonly publicBase = `${environment.apiUrl}/talent-bank/public`;
  private readonly base = `${environment.apiUrl}/talent-bank`;

  constructor(private http: HttpClient) {}

  // ── Público ───────────────────────────────────────────────────────────────

  /**
   * Responde a mesma frase para e-mail novo e para e-mail que já existe.
   * A tela não pode tratar as duas respostas de jeitos diferentes — não há como.
   */
  inscrever(dados: CreateTalentBankEntryDTO, curriculo: File): Observable<string> {
    const form = new FormData();
    form.append('dados', new Blob([JSON.stringify(dados)], { type: 'application/json' }));
    form.append('curriculo', curriculo, curriculo.name);
    return this.http.post(this.publicBase, form, { responseType: 'text' });
  }

  pedirLink(email: string): Observable<string> {
    return this.http.post(`${this.publicBase}/access-link`, { email }, { responseType: 'text' });
  }

  ver(token: string): Observable<TalentBankEntryDTO> {
    return this.http.get<TalentBankEntryDTO>(`${this.publicBase}/${encodeURIComponent(token)}`);
  }

  baixarCurriculoPorToken(token: string): Observable<Blob> {
    return this.http.get(`${this.publicBase}/${encodeURIComponent(token)}/curriculo`, { responseType: 'blob' });
  }

  atualizar(token: string, dados: UpdateTalentBankEntryDTO, curriculo: File | null): Observable<TalentBankEntryDTO> {
    const form = new FormData();
    form.append('dados', new Blob([JSON.stringify(dados)], { type: 'application/json' }));
    if (curriculo) {
      form.append('curriculo', curriculo, curriculo.name);
    }
    return this.http.put<TalentBankEntryDTO>(`${this.publicBase}/${encodeURIComponent(token)}`, form);
  }

  excluirPorToken(token: string): Observable<void> {
    return this.http.delete<void>(`${this.publicBase}/${encodeURIComponent(token)}`);
  }

  // ── Interno (aba do painel de vagas) ──────────────────────────────────────

  listar(filtros: TalentBankFiltros): Observable<TalentBankSummaryDTO[]> {
    let params = new HttpParams()
      .set('origem', filtros.origem)
      .set('consentimento', filtros.consentimento)
      .set('situacao', filtros.situacao);

    if (filtros.q.trim()) params = params.set('q', filtros.q.trim());
    if (filtros.area) params = params.set('area', filtros.area);

    return this.http.get<TalentBankSummaryDTO[]>(this.base, { params });
  }

  baixarCurriculo(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/curriculo`, { responseType: 'blob' });
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
