import { Injectable, signal } from '@angular/core';
import { DetachedRouteHandle } from '@angular/router';

/**
 * Guarda os componentes das abas que estão fora de tela.
 *
 * Existe separado do `TabsService` de propósito: a `RouteReuseStrategy` é
 * injetada dentro do próprio `Router`, então tudo que ela depende não pode
 * depender do `Router` de volta — senão vira dependência circular. Este store
 * não injeta nada.
 */
@Injectable({ providedIn: 'root' })
export class TabHandleStore {

  private readonly handles = new Map<string, DetachedRouteHandle>();

  /** Modo abas ligado (desktop). No mobile a navegação volta a ser uma tela por vez. */
  readonly enabled = signal(false);

  constructor() {
    // Precisa valer já na primeira navegação: este store nasce junto com o
    // roteador, antes de qualquer tela. Se dependesse do TabsService (que só
    // nasce com a barra de abas), a primeira tela aberta não seria preservada.
    const query = window.matchMedia('(min-width: 769px)');

    const apply = () => {
      this.enabled.set(query.matches);
      if (!query.matches) this.clear();
    };

    query.addEventListener('change', apply);
    apply();
  }

  set(url: string, handle: DetachedRouteHandle): void {
    // Se já havia algo guardado para esta URL, destrói antes de sobrescrever.
    this.destroy(url);
    this.handles.set(url, handle);
  }

  get(url: string): DetachedRouteHandle | undefined {
    return this.handles.get(url);
  }

  has(url: string): boolean {
    return this.handles.has(url);
  }

  /** Instância viva do componente guardado, quando existir. */
  componentOf(url: string): unknown {
    return (this.handles.get(url) as { componentRef?: { instance?: unknown } })?.componentRef?.instance;
  }

  /**
   * Tira a entrada do mapa SEM destruir o componente.
   *
   * É o que o roteador pede quando reanexa a tela: ela volta a viver na página,
   * então não pode mais ficar guardada aqui — mas continua viva.
   */
  forget(url: string): void {
    this.handles.delete(url);
  }

  /**
   * Destrói o componente guardado. Sem isto, fechar uma aba só tira o item da
   * lista e deixa o componente vivo para sempre — é o vazamento clássico de
   * quem usa RouteReuseStrategy.
   */
  destroy(url: string): void {
    const handle = this.handles.get(url) as { componentRef?: { destroy(): void } } | undefined;
    handle?.componentRef?.destroy();
    this.handles.delete(url);
  }

  clear(): void {
    for (const url of [...this.handles.keys()]) this.destroy(url);
  }
}
