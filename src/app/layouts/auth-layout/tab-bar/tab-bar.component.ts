import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';

import { TabsService, WorkTab } from '../../../infrastructure/services/tabs.service';

/** O que está esperando confirmação por ter alteração não salva. */
interface PendingClose {
  kind: 'one' | 'others' | 'all';
  url?: string;
  dirtyCount: number;
}

/** Barra das telas abertas, logo abaixo da topbar. Só existe no desktop. */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss',
})
export class TabBarComponent {

  readonly tabs = inject(TabsService);

  private readonly elRef = inject(ElementRef);

  readonly menuOpen = signal(false);
  readonly pending = signal<PendingClose | null>(null);

  /** Botão do meio do mouse fecha a aba, como no navegador. */
  onAuxClick(event: MouseEvent, tab: WorkTab): void {
    if (event.button !== 1) return;
    event.preventDefault();
    this.requestClose(tab);
  }

  // ── Fechamento (pede confirmação quando há alteração não salva) ───────────

  requestClose(tab: WorkTab): void {
    if (!this.tabs.isDirty(tab.url)) {
      this.tabs.close(tab.url);
      return;
    }
    this.pending.set({ kind: 'one', url: tab.url, dirtyCount: 1 });
  }

  requestCloseOthers(): void {
    this.menuOpen.set(false);
    const dirtyCount = this.tabs.dirtyCount(this.tabs.activeUrl());

    if (!dirtyCount) {
      this.tabs.closeOthers(this.tabs.activeUrl());
      return;
    }
    this.pending.set({ kind: 'others', dirtyCount });
  }

  requestCloseAll(): void {
    this.menuOpen.set(false);
    const dirtyCount = this.tabs.dirtyCount();

    if (!dirtyCount) {
      this.tabs.closeAll();
      return;
    }
    this.pending.set({ kind: 'all', dirtyCount });
  }

  confirmClose(): void {
    const pending = this.pending();
    if (!pending) return;

    if (pending.kind === 'one' && pending.url) this.tabs.close(pending.url);
    if (pending.kind === 'others') this.tabs.closeOthers(this.tabs.activeUrl());
    if (pending.kind === 'all') this.tabs.closeAll();

    this.pending.set(null);
  }

  cancelClose(): void {
    this.pending.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.pending.set(null);
    this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) this.menuOpen.set(false);
  }
}
