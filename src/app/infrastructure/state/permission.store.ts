import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

/** O que a API devolve: `{ 'stock/movements': ['CONSULTAR', 'EXCLUIR'] }`. */
export type PermissionMap = Record<string, string[]>;

/**
 * O que a pessoa logada pode fazer, por tela.
 *
 * Vem de `GET api/me/permissions` e **não do token**: duzentas strings de ~25
 * caracteres passariam de 5 KB, e o token viaja em toda requisição.
 *
 * O mapa é a forma certa para quem consome. O guard pergunta "entra nesta
 * tela?" a cada item de menu e a cada render — com lista de `tela:ACAO` isso
 * seria varrer duzentas strings procurando prefixo.
 */
@Injectable({ providedIn: 'root' })
export class PermissionStore {

  private readonly http = inject(HttpClient);

  private readonly _permissions = signal<PermissionMap>({});
  private readonly _loaded = signal(false);

  readonly permissions = this._permissions.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /**
   * A requisição em andamento, compartilhada.
   *
   * Sem isto, os cinco itens de menu que renderizam juntos disparariam cinco
   * chamadas iguais. O `shareReplay` faz todos esperarem a mesma.
   */
  private pending?: Observable<PermissionMap>;

  /**
   * Garante que as permissões chegaram antes de alguém decidir com base nelas.
   *
   * **É o que resolve a corrida.** O guard roda no primeiro clique, e as
   * permissões chegam por HTTP — sem esperar, ele decidiria com o mapa vazio e
   * barraria todo mundo no primeiro acesso, uma vez, de forma intermitente.
   * Esse é o tipo de defeito que só aparece na máquina de quem tem internet
   * ruim.
   */
  ensureLoaded(): Observable<PermissionMap> {
    if (this._loaded()) return of(this._permissions());
    if (this.pending) return this.pending;

    this.pending = this.http.get<PermissionMap>(`${environment.apiUrl}/me/permissions`).pipe(
      map(map => map ?? {}),
      tap(map => {
        this._permissions.set(map);
        this._loaded.set(true);
        this.pending = undefined;
      }),
      // Falhar aqui não pode travar a navegação num erro que ninguém entende.
      // Mapa vazio significa "não vê nada", e a tela de acesso negado explica —
      // que é melhor que uma tela branca sem mensagem.
      catchError(() => {
        this._permissions.set({});
        this._loaded.set(true);
        this.pending = undefined;
        return of({} as PermissionMap);
      }),
      shareReplay(1),
    );

    return this.pending;
  }

  /**
   * A pessoa vê esta tela?
   *
   * **Qualquer uma das sete basta.** Usar `CONSULTAR` como porta fecharia um
   * caso real: um técnico que precisa *lançar* um reembolso sem poder *ver* os
   * dos outros entra na tela e não enxerga a lista.
   */
  canOpen(screen: string): boolean {
    return (this._permissions()[screen]?.length ?? 0) > 0;
  }

  /** A pessoa pode esta ação nesta tela? Usado pela diretiva `*pkCan`. */
  can(screen: string, permission: string): boolean {
    return this._permissions()[screen]?.includes(permission) ?? false;
  }

  /**
   * `'stock/movements:EXCLUIR'` — o mesmo formato da authority da API.
   *
   * Existe para o `*pkCan` receber uma string só no template, que é o que faz
   * ele caber numa linha: `<pk-button *pkCan="'stock/movements:EXCLUIR'">`.
   */
  canByCode(code: string): boolean {
    const [screen, permission] = code.split(':', 2);
    return permission ? this.can(screen, permission) : this.canOpen(screen);
  }

  /** Quantas telas a pessoa enxerga — usado pelo menu para saber se há algo. */
  readonly screenCount = computed(() => Object.keys(this._permissions()).length);

  /** No logout, esquece. Senão o próximo login herda as permissões do anterior. */
  clear(): void {
    this._permissions.set({});
    this._loaded.set(false);
    this.pending = undefined;
  }
}
