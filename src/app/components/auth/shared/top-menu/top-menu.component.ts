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

@Component({
    selector: 'top-menu',
    imports: [MenubarModule, BadgeModule, AvatarModule, InputTextModule, RippleModule, CommonModule, ButtonModule, RouterModule],
    templateUrl: './top-menu.component.html',
    styleUrl: './top-menu.component.scss'
})
export class TopMenuComponent implements OnInit {
  items: MenuItem[] | undefined;

  ngOnInit() {
    this.items = [
      { label: 'Inicio', icon: 'pi pi-fw pi-home', routerLink: ['home'] },
      { label: 'Administrativo', icon: 'pi pi-fw pi-user',
        items: [
          { label: 'Admin', icon: 'pi pi-fw pi-user', routerLink: ['admin']},
        ]
       },
       { label: 'Documentos', icon: 'pi pi-fw pi-file',
        items: [
          { label: 'Holerit', icon: 'pi pi-fw pi-file', routerLink: ['documents/holerit']},
       ]
      },
      { label: 'Parceiros', icon: 'pi pi-fw pi-users',
        items: [
          { label: 'Clientes', icon: 'pi pi-fw pi-user', routerLink: ['partners/customers']},
          { label: 'Funcionários', icon: 'pi pi-fw pi-user', routerLink: ['partners/employees']},
          { label: 'Locais de Serviço', icon: 'pi pi-fw pi-map-marker', routerLink: ['partners/services-locations']},
       ]
      },
      {
        label: 'Empresa', icon: 'pi pi-fw pi-briefcase',
        items:[
          { label: 'Produtos', icon: 'pi pi-fw pi-tags', routerLink: ['company/products']},
          { label: 'Inventário', icon: 'pi pi-fw pi-box',
            items: [
              { label: 'Controle de Estoque', icon: 'pi pi-fw pi-box', routerLink: ['company/inventory']},
            ]
          },
          { label: 'Veículos', icon: 'pi pi-fw pi-car',
            items: [
              { label: 'Lista de veículos', icon: 'pi pi-fw pi-list', routerLink: ['company/vehicle']}
            ]
          }
        ]
      },
      { label: 'Configurações', icon: 'pi pi-fw pi-cog',
        items: [
          { label: 'Email', icon: 'pi pi-fw pi-envelope', routerLink: ['settings/email']},
        ]
      },
      { label: '- Suporte', icon: 'fa-solid fa-ticket',
        items: [
          { label: 'Contato', icon: 'pi pi-fw pi-phone', routerLink: ['support/contact']},
        ]
      },
    ];
  }

  logout(){
    localStorage.removeItem('token');
    window.location.href = '/';
  }
}
