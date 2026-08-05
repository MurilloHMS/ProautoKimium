import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';

import { TabsService, WorkTab } from '../../../infrastructure/services/tabs.service';

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

  /** Botão do meio do mouse fecha a aba, como no navegador. */
  onAuxClick(event: MouseEvent, tab: WorkTab): void {
    if (event.button !== 1) return;
    event.preventDefault();
    this.tabs.close(tab.url);
  }

  closeOthers(): void {
    this.menuOpen.set(false);
    this.tabs.closeOthers(this.tabs.activeUrl());
  }

  closeAll(): void {
    this.menuOpen.set(false);
    this.tabs.closeAll();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) this.menuOpen.set(false);
  }
}
