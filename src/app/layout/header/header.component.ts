import { Component, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  menuAberto = false;

  toggleMenu() {
    this.menuAberto = !this.menuAberto;
    this.atualizarScrollLock();
  }

  fecharMenuMobile() {
    if (!this.menuAberto) return;
    this.menuAberto = false;
    this.atualizarScrollLock();
  }

  /** Fecha o drawer ao pressionar ESC. */
  @HostListener('document:keydown.escape')
  onEscape() {
    this.fecharMenuMobile();
  }

  /** Garante que o drawer não fique aberto ao voltar para a largura desktop. */
  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 992 && this.menuAberto) {
      this.fecharMenuMobile();
    }
  }

  /** Trava o scroll do fundo enquanto o drawer está aberto. */
  private atualizarScrollLock() {
    document.body.style.overflow = this.menuAberto ? 'hidden' : '';
  }
}
