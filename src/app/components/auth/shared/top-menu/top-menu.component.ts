import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../../../../infrastructure/services/auth.service';

// ─── Interfaces ────────────────────────────────────────────────

interface AppMenuItem extends MenuItem {
  roles?: string[];
  _expanded?: boolean;
  items?: AppMenuItem[];
}

interface FlatMenuItem {
  label: string;
  icon: string;
  routerLink?: any[];
  url?: string;
  target?: string;
  breadcrumb: string;
}

// ─── Componente ────────────────────────────────────────────────

@Component({
  selector: 'top-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    BadgeModule,
    AvatarModule,
    ButtonModule,
    InputTextModule,
    RippleModule,
  ],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss'],
})
export class TopMenuComponent implements OnInit, OnDestroy {

  // ── Estado público ───────────────────────────────────────────
  items: AppMenuItem[] = [];
  drawerVisible = false;
  searchQuery = '';
  searchResults: FlatMenuItem[] = [];
  showSearchResults = false;

  // ── Estado interno ───────────────────────────────────────────
  private allFlatItems: FlatMenuItem[] = [];
  private hoverOpenTimer: any = null;
  private hoverCloseTimer: any = null;
  private readonly HOVER_OPEN_DELAY  = 300;
  private readonly HOVER_CLOSE_DELAY = 400;

  constructor(public auth: AuthService, private elRef: ElementRef) {}

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  ngOnInit(): void {
    const menu: AppMenuItem[] = [
      {
        label: 'Inicio',
        icon: 'pi pi-fw pi-home',
        routerLink: ['home'],
      },
      {
        label: 'Documentos',
        icon: 'pi pi-fw pi-folder',
        routerLink: ['documentos'],
      },
      {
        label: 'RH - Recursos Humanos',
        icon: 'pi pi-fw pi-users',
        items: [
          { label: 'Portal de Vagas', icon: 'pi pi-fw pi-briefcase', routerLink: ['rh/painel-de-vagas'], roles: ['ADMIN', 'RH'] },
          { label: 'Holerit',                icon: 'pi pi-fw pi-file',      routerLink: ['rh/holerit'],          roles: ['ADMIN', 'RH'] },
          { label: 'Coletar dados Holerite',  icon: 'pi pi-fw pi-file-arrow-up',      routerLink: ['rh/holerit/extractor'],roles: ['ADMIN', 'RH'] },
          { label: 'Funcionários', icon: 'pi pi-fw pi-user', routerLink: ['rh/employees'], roles: ['ADMIN', 'RH', 'MARKETING'] }
        ],
      },
      {
        label: 'Financeiro',
        icon: 'pi pi-fw pi-money-bill',
        items: [
          { label: 'Gerar Recibos Locação', icon: 'pi pi-fw pi-file-export', routerLink: ['finance/rent-receipt-generator'], roles: ['ADMIN', 'FINANCEIRO'] },
        ]
      },
      {
        label: 'Empresa',
        icon: 'pi pi-fw pi-building',
        items: [
          { label: 'Clientes',     icon: 'pi pi-fw pi-user', routerLink: ['company/customers'], roles: ['ADMIN', 'RH', 'MARKETING'] },
          { label: 'Coletar Dados NFe',       icon: 'pi pi-fw pi-file',      routerLink: ['company/nfe-collector'],    roles: ['ADMIN', 'RH', 'FINANCEIRO', 'COMPRADOR'] },
          { label: 'Remover Senha do Excel',  icon: 'pi pi-fw pi-lock',      routerLink: ['company/excel'] },
          { label: 'Abastecimento', icon: 'pi pi-fw pi-gauge', routerLink: ['company/fuel-supply'], roles: ['ADMIN', 'COMPRADOR'] },
          { label: 'Guia de Utilização', icon: 'pi pi-file-pdf', routerLink: ['company/guide'], roles: ['ADMIN', 'ADMINISTRATIVO'] },
        ],
      },
      {
        label: 'Comunicação',
        icon: 'pi pi-fw pi-comments',
        items: [
          { label: 'Newsletter',             icon: 'pi pi-fw pi-envelope', routerLink: ['communication/newsletter'], roles: ['ADMIN', 'MARKETING'] },
          { label: 'Disparo de Emails',      icon: 'pi pi-fw pi-send',     routerLink: ['communication/email'],      roles: ['ADMIN', 'MARKETING', 'RH', 'SUPPORT', 'DESIGN'] },
          { label: 'Comunicação Protegida',  icon: 'pi pi-fw pi-lock',     routerLink: ['communication/secrets'],    roles: ['ADMIN', 'MARKETING', 'RH', 'VENDEDOR'] },
          { label: 'Assinatura de Email',     icon: 'pi pi-fw pi-file',      routerLink: ['communication/email-signature'],  roles: ['ADMIN', 'RH', 'MARKETING', 'DESIGN', 'VENDEDOR'] },
          { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['communication/contact'], roles: ['ADMIN', 'SUPPORT'] }
        ],
      },
      {
        label: 'Configurações',
        icon: 'pi pi-fw pi-cog',
        items: [
          { label: 'Produtos do site', icon: 'pi pi-fw pi-tags', routerLink: ['settings/products/website'], roles: ['ADMIN', 'DESIGN', 'MARKETING'] },
          { label: 'Faq', icon: 'pi pi-question-circle', routerLink: ['faq/manager'], roles: ['ADMIN']},
          { label: 'Perfil', icon: 'pi pi-question-circle', routerLink: ['profile-manager'], roles: ['ADMIN']},
          { label: 'Admin', icon: 'pi pi-fw pi-user', routerLink: ['settings/admin'], roles: ['ADMIN'] },
        ],
      },
      {
        label: 'Apps Externos',
        icon: 'pi pi-fw pi-external-link',
        items: [
          { label: 'NextCloud',          icon: 'pi pi-fw pi-cloud',    url: 'https://cloud.proautokimium.com.br/',               target: '_blank' },
          { label: 'N8N',                icon: 'pi pi-fw pi-cog',      url: 'https://n8n.proautokimium.com.br/',                 target: '_blank' },
          { label: 'PDF',                icon: 'pi pi-fw pi-file-pdf', url: 'https://pdf.proautokimium.com.br/',                 target: '_blank' },
          { label: 'Jenkins',            icon: 'pi pi-fw pi-cog',      url: 'https://jenkins.proautokimium.com.br/',             target: '_blank' },
          { label: 'Api (Documentação)', icon: 'pi pi-fw pi-file',     url: 'https://api.proautokimium.com/swagger-ui/index.html', target: '_blank' },
          { label: 'GLPI (Chamados)',    icon: 'pi pi-fw pi-ticket',   url: 'https://infra.proautokimium.com.br/',               target: '_blank' },
        ],
      },
    ];

    this.items = this.filterMenuByRoles(menu);
    this.allFlatItems = this.flattenMenu(this.items);
  }

  ngOnDestroy(): void {
    this.clearHoverTimers();
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS DE TIPO (cast seguro para AppMenuItem)
  // ═══════════════════════════════════════════════════════════

  asAppItem(item: MenuItem): AppMenuItem  { return item as AppMenuItem; }
  asAppItems(items: MenuItem[]): AppMenuItem[] { return items as AppMenuItem[]; }

  // ═══════════════════════════════════════════════════════════
  // DRAWER — abertura / fechamento
  // ═══════════════════════════════════════════════════════════

  closeDrawer(): void {
    this.drawerVisible = false;
    this.clearHoverTimers();
  }

  // Hover pela borda esquerda da tela
  onDrawerZoneEnter(): void {
    this.clearHoverTimers();
    if (!this.drawerVisible) {
      this.hoverOpenTimer = setTimeout(() => { this.drawerVisible = true; }, this.HOVER_OPEN_DELAY);
    }
  }

  onDrawerZoneLeave(): void {
    this.clearHoverTimers();
    if (this.drawerVisible) {
      this.hoverCloseTimer = setTimeout(() => { this.drawerVisible = false; }, this.HOVER_CLOSE_DELAY);
    }
  }

  // Hover dentro do próprio drawer (cancela o timer de fechar)
  onDrawerMouseEnter(): void { this.clearHoverTimers(); }

  onDrawerMouseLeave(): void {
    this.hoverCloseTimer = setTimeout(() => { this.drawerVisible = false; }, this.HOVER_CLOSE_DELAY);
  }

  private clearHoverTimers(): void {
    if (this.hoverOpenTimer)  { clearTimeout(this.hoverOpenTimer);  this.hoverOpenTimer  = null; }
    if (this.hoverCloseTimer) { clearTimeout(this.hoverCloseTimer); this.hoverCloseTimer = null; }
  }

  // ═══════════════════════════════════════════════════════════
  // MENU — expansão de submenus
  // ═══════════════════════════════════════════════════════════

  /** Nível 1: fecha todos e abre o clicado (accordion) */
  toggleSubmenu(item: AppMenuItem): void {
    const wasExpanded = item._expanded;
    this.items.forEach(i => (i._expanded = false));
    item._expanded = !wasExpanded;
  }

  /** Nível 2: accordion entre irmãos */
  toggleSubmenuNested(item: AppMenuItem, siblings: AppMenuItem[]): void {
    const wasExpanded = item._expanded;
    siblings.forEach(i => (i._expanded = false));
    item._expanded = !wasExpanded;
  }

  // ═══════════════════════════════════════════════════════════
  // BUSCA
  // ═══════════════════════════════════════════════════════════

  onSearchInput(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) { this.searchResults = []; this.showSearchResults = false; return; }

    this.searchResults = this.allFlatItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.breadcrumb.toLowerCase().includes(q)
    );
    this.showSearchResults = true;
  }

  onSearchFocus(): void {
    if (this.searchQuery.trim()) this.showSearchResults = true;
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

  // ═══════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════

  logout(): void {
    this.auth.logout();
    window.location.href = '/';
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITÁRIOS PRIVADOS
  // ═══════════════════════════════════════════════════════════

  /** Transforma a árvore de menu num array plano para a busca */
  private flattenMenu(items: AppMenuItem[], breadcrumb = ''): FlatMenuItem[] {
    const result: FlatMenuItem[] = [];
    for (const item of items) {
      const crumb = breadcrumb ? `${breadcrumb} › ${item.label}` : (item.label ?? '');
      if (item.routerLink || item.url) {
        result.push({
          label:      item.label ?? '',
          icon:       item.icon  ?? 'pi pi-circle',
          routerLink: item.routerLink as any[],
          url:        item.url,
          target:     item.target,
          breadcrumb: crumb,
        });
      }
      if (item.items?.length) result.push(...this.flattenMenu(item.items, crumb));
    }
    return result;
  }

  /** Remove itens cujo role o usuário não possui (recursivo) */
  private filterMenuByRoles(items: AppMenuItem[]): AppMenuItem[] {
    return items
      .filter(item => !item.roles?.length || this.auth.hasRole(item.roles))
      .map(item => ({
        ...item,
        _expanded: false,
        items: item.items ? this.filterMenuByRoles(item.items) : undefined,
      }))
      .filter(item => !item.items || item.items.length > 0);
  }
}
