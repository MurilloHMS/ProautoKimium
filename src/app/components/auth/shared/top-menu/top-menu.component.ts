import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { InputTextModule } from 'primeng/inputtext';
import { CommonModule } from '@angular/common';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'top-menu',
  standalone: true,
  imports: [MenubarModule, BadgeModule, AvatarModule, InputTextModule, RippleModule, CommonModule],
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
}
