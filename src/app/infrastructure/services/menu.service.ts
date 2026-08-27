import { Injectable, inject } from '@angular/core';
import { PermissionStore } from '../state/permission.store';
import { APP_MENU, AppMenuItem, MOBILE_NAV } from '../../layouts/auth-layout/menu.config';

/** Item de menu achatado — usado pela busca e pelo breadcrumb da topbar. */
export interface FlatMenuItem {
  label: string;
  icon: string;
  routerLink?: string[];
  url?: string;
  target?: string;
  /** Caminho completo até o item, ex.: "RH › Aprovações › Férias". */
  breadcrumb: string;
  /** URL absoluta correspondente ao routerLink, ex.: "/rh/vacation-requests". */
  path: string;
}

/**
 * Fonte única da navegação autenticada: filtra o menu pelos papéis do usuário e
 * serve as três visões que o shell precisa (drawer, busca/breadcrumb e bottom nav).
 *
 * O resultado é memoizado pela combinação de papéis do token — assim trocar de
 * usuário (ou o token expirar) recalcula sozinho, sem depender de ciclo de vida
 * de componente.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {

  private readonly permissions = inject(PermissionStore);


  private cacheKey: string | null = null;
  private cachedMenu: AppMenuItem[] = [];
  private cachedFlat: FlatMenuItem[] = [];
  private cachedMobile: AppMenuItem[] = [];

  /** Árvore de menu visível para o usuário atual. */
  menu(): AppMenuItem[] {
    this.refreshIfNeeded();
    return this.cachedMenu;
  }

  /** Todos os destinos visíveis, achatados, com breadcrumb pronto. */
  flatItems(): FlatMenuItem[] {
    this.refreshIfNeeded();
    return this.cachedFlat;
  }

  /** Itens do bottom nav (mobile) permitidos para o usuário atual. */
  mobileItems(): AppMenuItem[] {
    this.refreshIfNeeded();
    return this.cachedMobile;
  }

  /** Busca por rótulo ou caminho — alimenta o campo de busca da topbar. */
  search(query: string): FlatMenuItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return this.flatItems().filter(item =>
      item.label.toLowerCase().includes(q) || item.breadcrumb.toLowerCase().includes(q)
    );
  }

  /** Item cujo caminho casa com a URL atual — base do breadcrumb da topbar. */
  findByUrl(url: string): FlatMenuItem | undefined {
    const clean = url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

    return this.flatItems()
      .filter(item => item.path && (clean === item.path || clean.startsWith(`${item.path}/`)))
      .sort((a, b) => b.path.length - a.path.length)[0];
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  /**
   * A chave do cache são as telas que a pessoa enxerga.
   *
   * As permissões chegam **depois** do login, por HTTP: sem elas na chave, o
   * menu ficaria congelado no que foi calculado antes da resposta chegar —
   * vazio. As roles saíram da chave no passo 6, junto com o resto: elas não
   * decidem mais nada de menu.
   */
  private refreshIfNeeded(): void {
    const key = Object.keys(this.permissions.permissions()).sort().join('|');

    if (key === this.cacheKey) return;

    this.cacheKey = key;
    this.cachedMenu = this.filterByAccess(APP_MENU);
    this.cachedFlat = this.flatten(this.cachedMenu);
    this.cachedMobile = MOBILE_NAV.filter(item => this.isAllowed(item));
  }

  /**
   * Item sem `screen` aparece para todo logado.
   *
   * São os que não participam do controle — início, notificações — e as pastas,
   * que não têm rota própria: elas somem sozinhas quando todos os filhos somem,
   * pelo último `filter` do método abaixo.
   */
  private isAllowed(item: AppMenuItem): boolean {
    if (!item.screen) return true;
    return this.permissions.canOpen(item.screen);
  }

  /** Remove itens sem permissão e grupos que ficaram vazios (recursivo). */
  private filterByAccess(items: AppMenuItem[]): AppMenuItem[] {
    return items
      .filter(item => this.isAllowed(item))
      .map(item => ({
        ...item,
        items: item.items ? this.filterByAccess(item.items) : undefined,
      }))
      .filter(item => !item.items || item.items.length > 0);
  }

  private flatten(items: AppMenuItem[], breadcrumb = ''): FlatMenuItem[] {
    const result: FlatMenuItem[] = [];

    for (const item of items) {
      const crumb = breadcrumb ? `${breadcrumb} › ${item.label}` : item.label;

      if (item.routerLink || item.url) {
        result.push({
          label: item.label,
          icon: item.icon,
          routerLink: item.routerLink,
          url: item.url,
          target: item.target,
          breadcrumb: crumb,
          path: item.routerLink ? `/${item.routerLink.join('/')}` : '',
        });
      }

      if (item.items?.length) result.push(...this.flatten(item.items, crumb));
    }

    return result;
  }
}
