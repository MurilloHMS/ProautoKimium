import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { RippleModule } from 'primeng/ripple';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../infrastructure/services/auth.service';

interface AppMenuItem extends MenuItem {
  roles?: string[];
}

@Component({
  selector: 'top-menu',
  standalone: true,
  imports: [
    MenubarModule,
    BadgeModule,
    AvatarModule,
    InputTextModule,
    RippleModule,
    CommonModule,
    ButtonModule,
    RouterModule
  ],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent implements OnInit {

  items: MenuItem[] = [];

  constructor(public auth: AuthService) {}

  ngOnInit() {
    const menu: AppMenuItem[] = [
      { label: 'Inicio', icon: 'pi pi-fw pi-home', routerLink: ['home'] },
      {
        label: 'Administrativo', icon: 'pi pi-fw pi-user', roles: ['ADMIN'],
        items: [
          { label: 'Admin', icon: 'pi pi-fw pi-user', routerLink: ['admin'], roles: ['ADMIN'] },
        ]
      },
      {
        label: 'Documentos', icon: 'pi pi-fw pi-file',
        items: [
          { label: 'Holerit', icon: 'pi pi-fw pi-file', routerLink: ['documents/holerit'], roles: ['ADMIN','RH'] },
          { label: 'Coletar Dados NFe', icon: 'pi pi-fw pi-file', routerLink: ['documents/nfe-collector'], roles: ['ADMIN','RH','FINANCEIRO'] },
        ]
      },
      {
        label: 'Parceiros', icon: 'pi pi-fw pi-users',
        items: [
          { label: 'Clientes', icon: 'pi pi-fw pi-user', routerLink: ['partners/customers'], roles: ['ADMIN'] },
          { label: 'Funcionários', icon: 'pi pi-fw pi-user', routerLink: ['partners/employees'], roles: ['ADMIN','RH'] },
          { label: 'Locais de Serviço', icon: 'pi pi-fw pi-map-marker', routerLink: ['partners/services-locations'], roles: ['ADMIN'] },
        ]
      },
      {
        label: 'Empresa', icon: 'pi pi-fw pi-briefcase',
        items: [
          { label: 'Produtos', icon: 'pi pi-fw pi-tags', routerLink: ['company/products'], roles: ['ADMIN','ALMOXARIFADO'] },
          {
            label: 'Inventário', icon: 'pi pi-fw pi-box',
            items: [
              { label: 'Controle de Estoque', icon: 'pi pi-fw pi-box', routerLink: ['company/inventory'], roles: ['ADMIN','ALMOXARIFADO'] },
            ]
          },
          {
            label: 'Veículos', icon: 'pi pi-fw pi-car',
            items: [
              { label: 'Lista de veículos', icon: 'pi pi-fw pi-list', routerLink: ['company/vehicle'], roles: ['ADMIN','COMPRADOR'] }
            ]
          }
        ]
      },
      {
        label: 'Suporte', icon: 'fa-solid fa-ticket',
        items: [
          { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['support/contact'], roles: ['ADMIN','SUPPORT'] },
        ]
      },
      { label: 'Comunicação', icon: 'pi pi-fw pi-comments',
        items: [
          { label: 'Newsletter', icon: 'pi pi-fw pi-envelope', routerLink: ['communication/newsletter'], roles: ['ADMIN','MARKETING'] },
        ]
      },
      {
        label: 'Configurações', icon: 'pi pi-fw pi-cog',
        items: [
          { label: 'Email', icon: 'pi pi-fw pi-envelope', routerLink: ['settings/email'], roles: ['ADMIN'] },
        ]
      }
    ];

    this.items = this.filterMenuByRoles(menu);
  }

  private filterMenuByRoles(items: AppMenuItem[]): AppMenuItem[] {
    return items
      .filter(item => {
        if (!item.roles || item.roles.length === 0) return true;
        return this.auth.hasRole(item.roles);
      })
      .map(item => {
        if (item.items) {
          return { ...item, items: this.filterMenuByRoles(item.items) };
        }
        return item;
      });
  }

  logout() {
    this.auth.logout();
    window.location.href = '/';
  }
}
