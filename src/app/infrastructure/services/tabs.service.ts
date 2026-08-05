import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { TabHandleStore } from '../routing/tab-handle.store';
import { isTabDirtyCheck } from '../routing/tab-dirty-check';
import { MenuService } from './menu.service';

export interface WorkTab {
  /** URL sem query string — é a identidade da aba. */
  url: string;
  label: string;
  icon: string;
}

const STORAGE_KEY = 'workspace-tabs';
const MAX_TABS = 8;

/**
 * Área de trabalho com abas.
 *
 * Uma aba por URL: clicar numa tela já aberta foca a aba existente em vez de
 * duplicar. Quem mantém a tela viva é a `TabReuseStrategy`; aqui fica só a
 * lista, a ordem, a aba ativa e a persistência.
 */
@Injectable({ providedIn: 'root' })
export class TabsService {

  private readonly router = inject(Router);
  private readonly menu = inject(MenuService);
  private readonly handles = inject(TabHandleStore);

  private readonly _tabs = signal<WorkTab[]>([]);
  private readonly _activeUrl = signal<string>('');

  /** Instância da tela em foco, entregue pelo (activate) do router-outlet. */
  private activeComponent: unknown = null;

  readonly tabs = this._tabs.asReadonly();
  readonly activeUrl = this._activeUrl.asReadonly();
  readonly enabled = this.handles.enabled.asReadonly();
  readonly hasMany = computed(() => this._tabs().length > 1);

  constructor() {
    this.restore();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.track(this.currentUrl()));

    // A primeira navegação pode ter acontecido antes deste serviço existir.
    if (this.currentUrl()) this.track(this.currentUrl());
  }

  // ── Alterações não salvas ────────────────────────────────────────────────

  /**
   * A tela em foco não está guardada no TabHandleStore (ela vive na página),
   * então o layout entrega a instância dela por aqui, pelo (activate) do
   * router-outlet.
   */
  setActiveComponent(instance: unknown): void {
    this.activeComponent = instance;
  }

  /** A aba tem formulário com alteração não salva? */
  isDirty(url: string): boolean {
    const instance = url === this._activeUrl()
      ? this.activeComponent
      : this.handles.componentOf(url);

    return isTabDirtyCheck(instance) ? instance.isTabDirty() : false;
  }

  /** Quantas abas estão sujas, ignorando uma opcional. */
  dirtyCount(exceptUrl?: string): number {
    return this._tabs().filter(tab => tab.url !== exceptUrl && this.isDirty(tab.url)).length;
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  activate(tab: WorkTab): void {
    this.router.navigateByUrl(tab.url);
  }

  close(url: string): void {
    const tabs = this._tabs();
    const index = tabs.findIndex(tab => tab.url === url);
    if (index === -1) return;

    this._tabs.set(tabs.filter(tab => tab.url !== url));
    this.handles.destroy(url);
    this.persist();

    if (this._activeUrl() !== url) return;

    // Fechou a aba aberta: vai para a vizinha da direita, senão a da esquerda.
    const remaining = this._tabs();
    const next = remaining[index] ?? remaining[index - 1];
    this.router.navigateByUrl(next?.url ?? '/home');
  }

  closeOthers(url: string): void {
    for (const tab of this._tabs()) {
      if (tab.url !== url) this.handles.destroy(tab.url);
    }
    this._tabs.set(this._tabs().filter(tab => tab.url === url));
    this.persist();
    if (this._activeUrl() !== url) this.router.navigateByUrl(url);
  }

  closeAll(): void {
    this.handles.clear();
    this._tabs.set([]);
    this.persist();
    this.router.navigateByUrl('/home');
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  private currentUrl(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }

  private track(url: string): void {
    if (!url || url === '/') return;

    this._activeUrl.set(url);

    if (this._tabs().some(tab => tab.url === url)) return;

    this._tabs.update(tabs => [...tabs, this.buildTab(url)]);
    this.enforceLimit();
    this.persist();
  }

  private buildTab(url: string): WorkTab {
    const fromMenu = this.menu.findByUrl(url);
    if (fromMenu) {
      return { url, label: fromMenu.label, icon: fromMenu.icon };
    }

    // Telas fora do menu (candidaturas, área pessoal) declaram o rótulo na rota.
    const data = this.deepestData();
    return {
      url,
      label: (data['title'] as string) ?? this.labelFromUrl(url),
      icon: (data['icon'] as string) ?? 'pi pi-file',
    };
  }

  private deepestData(): Record<string, unknown> {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let data: Record<string, unknown> = {};

    while (route) {
      data = { ...data, ...route.data };
      route = route.firstChild;
    }
    return data;
  }

  private labelFromUrl(url: string): string {
    const last = url.split('/').filter(Boolean).pop() ?? 'Tela';
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
  }

  /**
   * Estourou o limite: fecha a aba mais antiga que não seja a ativa nem tenha
   * alteração pendente. Se todas as candidatas estiverem sujas, não fecha nada
   * — perder cadastro em silêncio por causa de um limite seria pior.
   */
  private enforceLimit(): void {
    if (this._tabs().length <= MAX_TABS) return;

    const oldest = this._tabs().find(tab => tab.url !== this._activeUrl() && !this.isDirty(tab.url));
    if (oldest) this.close(oldest.url);
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tabs()));
  }

  /**
   * Restaura a lista de abas do recarregamento. Volta *quais* telas estavam
   * abertas — o conteúdo é buscado de novo do servidor. Abas de telas do menu
   * que o papel atual não enxerga mais são descartadas aqui.
   */
  private restore(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as WorkTab[];
      if (!Array.isArray(saved)) return;

      const allowedMenuPaths = new Set(this.menu.flatItems().map(item => item.path));

      this._tabs.set(
        saved
          .filter(tab => !!tab?.url)
          .filter(tab => !this.isMenuPath(tab.url) || allowedMenuPaths.has(tab.url))
          .slice(0, MAX_TABS)
      );
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /** A URL corresponde a um destino do menu (e portanto tem papel associado)? */
  private isMenuPath(url: string): boolean {
    return this.menu.flatItems().some(item => item.path === url) || url.startsWith('/rh/')
      || url.startsWith('/company/') || url.startsWith('/communication/') || url.startsWith('/settings/');
  }

}
