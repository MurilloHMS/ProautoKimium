import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { RippleModule } from 'primeng/ripple';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../infrastructure/services/auth.service';

interface AppMenuItem extends MenuItem {
  roles?: string[];
  _expanded?: boolean;
  items?: AppMenuItem[];
}

interface FlatMenuItem {
  label: string;
  icon: string;
  routerLink: any[];
  breadcrumb: string;
}

@Component({
  selector: 'top-menu',
  standalone: true,
  imports: [
    BadgeModule,
    AvatarModule,
    InputTextModule,
    RippleModule,
    CommonModule,
    ButtonModule,
    RouterModule,
    FormsModule,
  ],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss'],
})
export class TopMenuComponent implements OnInit, OnDestroy {
  items: AppMenuItem[] = [];
  drawerVisible = false;

  searchQuery = '';
  searchResults: FlatMenuItem[] = [];
  showSearchResults = false;
  private allFlatItems: FlatMenuItem[] = [];

  private hoverOpenTimer: any = null;
  private hoverCloseTimer: any = null;
  private readonly HOVER_OPEN_DELAY = 300;
  private readonly HOVER_CLOSE_DELAY = 400;

  constructor(public auth: AuthService, private elRef: ElementRef) {}

  ngOnInit() {
    const menu: AppMenuItem[] = [
      {
        label: 'Inicio',
        icon: 'pi pi-fw pi-home',
        routerLink: ['home'],
      },
      {
        label: 'Administrativo',
        icon: 'pi pi-fw pi-user',
        roles: ['ADMIN'],
        items: [
          { label: 'Admin', icon: 'pi pi-fw pi-user', routerLink: ['admin'], roles: ['ADMIN'] },
        ],
      },
      {
        label: 'Documentos',
        icon: 'pi pi-fw pi-file',
        items: [
          { label: 'Holerit', icon: 'pi pi-fw pi-file', routerLink: ['documents/holerit'], roles: ['ADMIN', 'RH'] },
          { label: 'Coletar Dados NFe', icon: 'pi pi-fw pi-file', routerLink: ['documents/nfe-collector'], roles: ['ADMIN', 'RH', 'FINANCEIRO'] },
          { label: 'Assinatura de Email', icon: 'pi pi-fw pi-file', routerLink: ['documents/email-signature'], roles: ['ADMIN', 'RH', 'MARKETING', 'DESIGN', 'VENDEDORES'] },
        ],
      },
      {
        label: 'Empresa',
        icon: 'pi pi-fw pi-briefcase',
        items: [
          { label: 'Produtos', icon: 'pi pi-fw pi-tags', routerLink: ['company/products'], roles: ['ADMIN', 'ALMOXARIFADO'] },
          {
            label: 'Inventário',
            icon: 'pi pi-fw pi-box',
            items: [
              { label: 'Controle de Estoque', icon: 'pi pi-fw pi-box', routerLink: ['company/inventory'], roles: ['ADMIN', 'ALMOXARIFADO'] },
            ],
          },
        ],
      },
      {
        label: 'Suporte',
        icon: 'fa-solid fa-ticket',
        items: [
          { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['support/contact'], roles: ['ADMIN', 'SUPPORT'] },
        ],
      },
      {
        label: 'Comunicação',
        icon: 'pi pi-fw pi-comments',
        items: [
          { label: 'Newsletter', icon: 'pi pi-fw pi-envelope', routerLink: ['communication/newsletter'], roles: ['ADMIN', 'MARKETING'] },
        ],
      },
    ];

    this.items = this.filterMenuByRoles(menu);
    this.allFlatItems = this.flattenMenu(this.items);
  }

  ngOnDestroy(): void {
    this.clearHoverTimers();
  }

  asAppItem(item: MenuItem): AppMenuItem {
    return item as AppMenuItem;
  }

  asAppItems(items: MenuItem[]): AppMenuItem[] {
    return items as AppMenuItem[];
  }

  toggleSubmenu(item: AppMenuItem): void {
    const wasExpanded = item._expanded;
    this.items.forEach((i) => (i._expanded = false));
    item._expanded = !wasExpanded;
  }

  toggleSubmenuNested(item: AppMenuItem, siblings: AppMenuItem[]): void {
    const wasExpanded = item._expanded;
    siblings.forEach((i) => (i._expanded = false));
    item._expanded = !wasExpanded;
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.clearHoverTimers();
  }

  onDrawerZoneEnter(): void {
    this.clearHoverTimers();
    if (!this.drawerVisible) {
      this.hoverOpenTimer = setTimeout(() => {
        this.drawerVisible = true;
      }, this.HOVER_OPEN_DELAY);
    }
  }

  onDrawerZoneLeave(): void {
    this.clearHoverTimers();
    if (this.drawerVisible) {
      this.hoverCloseTimer = setTimeout(() => {
        this.drawerVisible = false;
      }, this.HOVER_CLOSE_DELAY);
    }
  }

  onDrawerMouseEnter(): void {
    this.clearHoverTimers();
  }

  onDrawerMouseLeave(): void {
    this.hoverCloseTimer = setTimeout(() => {
      this.drawerVisible = false;
    }, this.HOVER_CLOSE_DELAY);
  }

  private clearHoverTimers(): void {
    if (this.hoverOpenTimer) { clearTimeout(this.hoverOpenTimer); this.hoverOpenTimer = null; }
    if (this.hoverCloseTimer) { clearTimeout(this.hoverCloseTimer); this.hoverCloseTimer = null; }
  }

  onSearchInput(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }
    this.searchResults = this.allFlatItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.breadcrumb.toLowerCase().includes(q)
    );
    this.showSearchResults = true;
  }

  onSearchFocus(): void {
    if (this.searchQuery.trim()) {
      this.showSearchResults = true;
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  navigateToResult(item: FlatMenuItem): void {
    this.clearSearch();
    this.closeDrawer();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.showSearchResults = false;
    }
  }

  private flattenMenu(items: AppMenuItem[], breadcrumb = ''): FlatMenuItem[] {
    const result: FlatMenuItem[] = [];
    for (const item of items) {
      const crumb = breadcrumb ? `${breadcrumb} › ${item.label}` : (item.label ?? '');
      if (item.routerLink) {
        result.push({
          label: item.label ?? '',
          icon: item.icon ?? 'pi pi-circle',
          routerLink: item.routerLink as any[],
          breadcrumb: crumb,
        });
      }
      if (item.items?.length) {
        result.push(...this.flattenMenu(item.items, crumb));
      }
    }
    return result;
  }

  private filterMenuByRoles(items: AppMenuItem[]): AppMenuItem[] {
    return items
      .filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        return this.auth.hasRole(item.roles);
      })
      .map((item) => {
        if (item.items) {
          const filteredChildren = this.filterMenuByRoles(item.items);
          return { ...item, _expanded: false, items: filteredChildren };
        }
        return { ...item, _expanded: false };
      })
      .filter((item) => !item.items || item.items.length > 0);
  }

  logout() {
    this.auth.logout();
    window.location.href = '/';
  }
}
