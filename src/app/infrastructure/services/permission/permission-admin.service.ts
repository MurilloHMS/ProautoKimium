import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApplyMode, ApplyResult, PermissionCells, ScreenRow,
  TemplateGrid, TemplateSummary, UserGrid, UserSummary,
} from '../../../domain/models/permission-admin.model';

/**
 * As telas que configuram quem pode o quê.
 *
 * Separado do `PermissionStore`, que guarda as permissões **de quem está
 * logado**: aquele é consultado a cada render de menu e a cada `*pkCan`, este
 * só existe dentro de duas telas. Misturar os dois faria o store carregar
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

  // ─── Modelos ───────────────────────────────────────────────────────────────

  templates(): Observable<TemplateSummary[]> {
    return this.http.get<TemplateSummary[]>(`${this.url}/templates`);
  }

  /**
   * Quem já foi carimbado com este modelo.
   *
   * A tela precisa dos ids, e não só do total: o aviso "3 usuários usaram este
   * carimbo" só vale acompanhado de um botão que sabe em quem mexer.
   */
  stampedWith(templateId: string): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.url}/templates/${templateId}/stamped-users`);
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

  copyFrom(userId: string, sourceUserId: string): Observable<ApplyResult> {
    return this.http.post<ApplyResult>(
      `${this.url}/users/${userId}/copy-from/${sourceUserId}`, {});
  }
}
