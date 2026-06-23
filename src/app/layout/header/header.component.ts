import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  menuAberto = false;

  /** Aba ativa do bottom nav (controla o indicador líquido). 0..3 = destinos. */
  activeIndex = 0;

  /** Rolou além do topo → barra superior encolhe (vidro mais denso). */
  scrolled = false;

  /** Rolando para baixo → bottom nav condensa (esconde rótulos). */
  navCondensed = false;

  private lastY = 0;
  private readonly scrollHandler = (e: Event) => this.handleScroll(e);

  ngOnInit() {
    // Captura a rolagem tanto da janela quanto de containers internos
    // (scroll não borbulha, mas a fase de captura alcança qualquer scroller).
    window.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.scrollHandler, { capture: true } as any);
  }

  setActive(i: number) {
    this.activeIndex = i;
  }

  toggleMenu() {
    this.menuAberto = !this.menuAberto;
    this.atualizarScrollLock();
  }

  fecharMenuMobile() {
    if (!this.menuAberto) return;
    this.menuAberto = false;
    this.atualizarScrollLock();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.fecharMenuMobile();
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 1024 && this.menuAberto) {
      this.fecharMenuMobile();
    }
  }

  /** Redimensionamento das barras de vidro conforme a rolagem. */
  private handleScroll(e: Event) {
    const target = e.target as (HTMLElement | Document | null);
    let y = window.scrollY || document.documentElement.scrollTop || 0;
    if (target && target !== document && (target as HTMLElement).scrollTop != null) {
      y = (target as HTMLElement).scrollTop || y;
    }

    this.scrolled = y > 8;

    if (y > this.lastY + 4 && y > 64) {
      this.navCondensed = true;          // descendo → condensa
    } else if (y < this.lastY - 4 || y < 64) {
      this.navCondensed = false;         // subindo ou perto do topo → expande
    }
    this.lastY = y;
  }

  private atualizarScrollLock() {
    document.body.style.overflow = this.menuAberto ? 'hidden' : '';
  }
}
