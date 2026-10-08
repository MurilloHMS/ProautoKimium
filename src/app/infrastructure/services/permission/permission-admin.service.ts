import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApplyMode, ApplyResult, PermissionCells, ReapplyPreview, ScreenAccessOverview, ScreenRow,
  TemplateGrid, TemplateSummary, UserGrid, UserSummary,
} from '../../../domain/models/permission-admin.model';

/**
 * As telas que configuram quem pode o quê.
 *
 * Separado do `PermissionStore`, que guarda as permissões **de quem está
 * logado**: aquele é consultado a cada render de menu e a cada `*pkCan`, este
 * só existe dentro da tela de administração. Misturar os dois faria o store carregar
 * catálogo e lista de usuários no login de todo mundo.
 */
@Injectable({ providedIn: 'root' })
export class PermissionAdminService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/permissions`;

  // ─── Catálogo ──────────────────────────────────────────────────────────────

  screens(): Observable<ScreenRow[]> {
    return this.http.get<ScreenRow[]>(`${this.url}/screens`);
  }

  /** Quem acessa cada tela, todas de uma vez: a aba Telas. */
  screenAccess(): Observable<ScreenAccessOverview> {
    return this.http.get<ScreenAccessOverview>(`${this.url}/screen-access`);
  }

  // ─── Modelos ───────────────────────────────────────────────────────────────

  templates(): Observable<TemplateSummary[]> {
    return this.http.get<TemplateSummary[]>(`${this.url}/templates`);
  }

  /**
   * A quem este modelo já foi aplicado.
   *
   * A tela precisa dos ids, e não só do total: o aviso "aplicado a 3 pessoas"
   * só vale acompanhado de um botão que sabe em quem mexer.
   */
  appliedTo(templateId: string): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.url}/templates/${templateId}/applied-to`);
  }

  templateGrid(templateId: string): Observable<TemplateGrid> {
    return this.http.get<TemplateGrid>(`${this.url}/templates/${templateId}/grid`);
  }

  /** Criar. Com `copyFromId`, é o duplicar — não é outro endpoint. */
  createTemplate(name: string, description: string | null,
                 copyFromId?: string): Observable<TemplateSummary> {
    return this.http.post<TemplateSummary>(`${this.url}/templates`,
      { name, description, copyFromId: copyFromId ?? null });
  }

  editTemplate(templateId: string,
               changes: { name?: string; description?: string; active?: boolean }): Observable<void> {
    return this.http.patch<void>(`${this.url}/templates/${templateId}`, changes);
  }

  /**
   * Grava a grade inteira do modelo.
   *
   * `PUT` e não `PATCH`: o corpo é a grade completa e **ausente é negado**. Se
   * ausência significasse "não mexer", desmarcar uma célula não teria como ser
   * expresso — o corpo ficaria igual ao de antes.
   */
  saveTemplateGrid(templateId: string, cells: PermissionCells): Observable<ApplyResult> {
    return this.http.put<ApplyResult>(`${this.url}/templates/${templateId}/grid`, { cells });
  }

  // ─── Pessoas ───────────────────────────────────────────────────────────────

  users(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.url}/users`);
  }

  userGrid(userId: string): Observable<UserGrid> {
    return this.http.get<UserGrid>(`${this.url}/users/${userId}/grid`);
  }

  saveUserGrid(userId: string, cells: PermissionCells): Observable<ApplyResult> {
    return this.http.put<ApplyResult>(`${this.url}/users/${userId}/grid`, { cells });
  }

  apply(templateId: string, userIds: string[], mode: ApplyMode): Observable<ApplyResult> {
    return this.http.post<ApplyResult>(`${this.url}/templates/${templateId}/apply`,
      { userIds, mode });
  }

  /**
   * Desfaz a aplicação de um modelo numa pessoa.
   *
   * Desliga o que **aquele** modelo deu, menos o que outro modelo aplicado
   * também dá — apagar só o registro não tiraria permissão nenhuma, porque ele
   * é anotação e não fonte.
   */
  undoApply(userId: string, templateId: string): Observable<ApplyResult> {
    return this.http.delete<ApplyResult>(`${this.url}/users/${userId}/templates/${templateId}`);
  }

  /** O que o "Reaplicar" faria, pessoa por pessoa. Só lê. */
  reapplyPreview(templateId: string): Observable<ReapplyPreview> {
    return this.http.get<ReapplyPreview>(`${this.url}/templates/${templateId}/reapply-preview`);
  }

  /**
   * Leva a versão nova do modelo a quem já o recebeu.
   *
   * A API refaz cada pessoa pela soma de todos os modelos dela — não deixa a
   * pessoa igual a este modelo, como o antigo "reaplicar com SUBSTITUIR" fazia.
   */
  reapply(templateId: string): Observable<ApplyResult> {
    return this.http.post<ApplyResult>(`${this.url}/templates/${templateId}/reapply`, {});
  }

  copyFrom(userId: string, sourceUserId: string): Observable<ApplyResult> {
    return this.http.post<ApplyResult>(
      `${this.url}/users/${userId}/copy-from/${sourceUserId}`, {});
  }
}
