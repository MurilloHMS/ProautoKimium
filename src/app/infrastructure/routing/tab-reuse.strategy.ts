import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  RouteReuseStrategy,
} from '@angular/router';

import { TabHandleStore } from './tab-handle.store';

/**
 * Mantém viva a tela de cada aba aberta.
 *
 * O roteador continua no comando — cada aba é uma URL, então guard de papel,
 * lazy loading e link direto seguem funcionando. O que muda é que, ao sair de
 * uma rota, o componente não é destruído: fica guardado e volta com o estado
 * intacto (filtro digitado, formulário preenchido) quando a aba é reaberta.
 */
@Injectable()
export class TabReuseStrategy implements RouteReuseStrategy {

  private readonly handles = inject(TabHandleStore);

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.handles.enabled() && !!this.keyOf(route) && this.isScreen(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.keyOf(route);
    if (!key) return;

    if (handle) {
      this.handles.set(key, handle);
      return;
    }

    // Handle nulo NÃO significa "destrua a tela": é o roteador avisando que
    // acabou de reanexá-la, então ela sai do mapa e volta a viver na página.
    // Destruir aqui fazia a tela sumir no primeiro clique e só aparecer no
    // segundo. Quem destrói de verdade é o fechamento da aba, no TabsService.
    this.handles.forget(key);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.keyOf(route);
    return this.handles.enabled() && !!key && this.handles.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.keyOf(route);
    if (!key) return null;
    return this.handles.get(key) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  /** Só telas: o layout e as rotas sem componente ficam de fora. */
  private isScreen(route: ActivatedRouteSnapshot): boolean {
    return !!route.routeConfig?.component || !!route.routeConfig?.loadComponent;
  }

  /** URL completa da rota, que é a identidade da aba. */
  private keyOf(route: ActivatedRouteSnapshot): string {
    const path = route.pathFromRoot
      .map(r => r.url.map(segment => segment.path).join('/'))
      .filter(Boolean)
      .join('/');

    return path ? `/${path}` : '';
  }
}
