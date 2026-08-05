import { Component, HostListener, ElementRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../../infrastructure/services/auth.service';
import { FlatMenuItem, MenuService } from '../../../infrastructure/services/menu.service';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { ThemeService } from '../../../infrastructure/services/theme.service';

/** Barra fixa do topo: menu, breadcrumb, busca, notificações, tema e usuário. */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {

  /** Pedido de abrir o drawer — quem controla o estado é o AuthLayout. */
  menuToggle = output<void>();

  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);
  private readonly menuService = inject(MenuService);

  readonly auth = inject(AuthService);
  readonly notifications = inject(NotificationService);
  readonly theme = inject(ThemeService);

  readonly breadcrumb = signal<string>('');

  readonly searchQuery = signal('');
  readonly searchResults = signal<FlatMenuItem[]>([]);
  readonly showResults = signal(false);
  /** Item destacado pelas setas do teclado; -1 = nenhum. */
  readonly activeIndex = signal(-1);

  readonly userMenuOpen = signal(false);

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.updateBreadcrumb());

    this.updateBreadcrumb();
  }

  // ── Busca ─────────────────────────────────────────────────────────────────

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchResults.set(this.menuService.search(value));
    this.showResults.set(value.trim().length > 0);
    this.activeIndex.set(-1);
  }

  onSearchFocus(): void {
    if (this.searchQuery().trim()) this.showResults.set(true);
  }

  /** ↑ ↓ percorrem os resultados, Enter navega, Esc fecha. */
  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();

    switch (event.key) {
      case 'ArrowDown':
        if (!results.length) return;
        event.preventDefault();
        this.showResults.set(true);
        this.activeIndex.update(i => (i + 1) % results.length);
        break;

      case 'ArrowUp':
        if (!results.length) return;
        event.preventDefault();
        this.activeIndex.update(i => (i <= 0 ? results.length - 1 : i - 1));
        break;

      case 'Enter': {
        const target = results[this.activeIndex()] ?? results[0];
        if (!target) return;
        event.preventDefault();
        this.goToResult(target);
        break;
      }

      case 'Escape':
        this.clearSearch();
        break;
    }
  }

  goToResult(item: FlatMenuItem): void {
    if (item.routerLink) {
      this.router.navigate(item.routerLink);
    } else if (item.url) {
      window.open(item.url, item.target ?? '_self');
    }
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showResults.set(false);
    this.activeIndex.set(-1);
  }

  // ── Usuário ───────────────────────────────────────────────────────────────

  get userRolesLabel(): string {
    const roles = this.auth.getUserRoles();
    return roles.length ? roles.join(', ') : 'Sem papéis';
  }

  logout(): void {
    this.auth.logout();
    window.location.href = '/';
  }

  // ── Fechar dropdowns ao clicar fora ──────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.elRef.nativeElement.contains(event.target)) return;
    this.showResults.set(false);
    this.userMenuOpen.set(false);
  }

  private updateBreadcrumb(): void {
    this.breadcrumb.set(this.menuService.findByUrl(this.router.url)?.breadcrumb ?? '');
  }
}
