import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

import { ClientAuthService } from '../../infrastructure/services/client/client-auth.service';
import { ClientSessionStore } from '../../infrastructure/state/client-session.store';
import { ThemeService } from '../../infrastructure/services/theme.service';

/**
 * Casca da Área do Cliente.
 *
 * Não é o shell do ERP: sem drawer, sem abas, sem menu de módulos. O cliente
 * tem uma tela só, e o cabeçalho existe para dizer quem ele é, deixar trocar
 * de unidade e sair.
 */
@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './client-layout.component.html',
  styleUrl: './client-layout.component.scss',
})
export class ClientLayoutComponent implements OnInit {

  private readonly auth = inject(ClientAuthService);
  private readonly router = inject(Router);

  readonly session = inject(ClientSessionStore);
  readonly theme = inject(ThemeService);

  readonly menuOpen = signal(false);
  readonly userOpen = signal(false);

  /** Iniciais para o avatar do cabeçalho, como no desenho ("BR"). */
  readonly initials = computed(() => {
    const parts = (this.session.me()?.nome ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  });

  ngOnInit(): void {
    this.session.load();
  }

  retry(): void {
    if (this.session.error() === 'expired') {
      this.logout();
      return;
    }
    this.session.load();
  }

  selectUnit(codParceiro: string | null): void {
    this.session.select(codParceiro);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.userOpen.set(false);
    this.menuOpen.update(open => !open);
  }

  toggleUser(): void {
    this.menuOpen.set(false);
    this.userOpen.update(open => !open);
  }

  logout(): void {
    this.auth.logout();
    this.session.clear();
    this.router.navigate(['/cliente/login']);
  }
}
