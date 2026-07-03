import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { NotificationService } from '../../../infrastructure/services/notification.service';


interface QuickLink {
  label: string;
  description: string;
  icon: string;
  link: string;
  accent: 'navy' | 'teal' | 'amber' | 'green' | 'purple' | 'red';
  roles?: string[];
}

@Component({
  selector: 'app-auth-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './auth-home.component.html',
  styleUrl: './auth-home.component.scss',
})
export class AuthHomeComponent {
  readonly currentDate = new Date();

  constructor(
    public auth: AuthService,
    public notifications: NotificationService,
  ) {}

  get greeting(): string {
    const h = this.currentDate.getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  get firstName(): string {
    const raw = (this.auth.getUsername() ?? '').trim();
    if (!raw) return '';
    const first = raw.split(/[.\s@_-]+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }

  get primaryRole(): string | null {
    return this.auth.getUserRoles()[0] ?? null;
  }

  readonly recentNotifications = computed(() =>
    this.notifications.notifications().slice(0, 4)
  );

  get quickLinks(): QuickLink[] {
    return this.QUICK_LINKS.filter(
      l => !l.roles?.length || this.auth.hasRole(l.roles)
    );
  }

  private readonly QUICK_LINKS: QuickLink[] = [
    { label: 'Documentos',            description: 'Arquivos e materiais da equipe', icon: 'pi pi-folder',      link: '/documentos',                       accent: 'navy'   },
    { label: 'Portal de Vagas',       description: 'Vagas e candidaturas',           icon: 'pi pi-briefcase',   link: '/rh/painel-de-vagas',               accent: 'teal',   roles: ['ADMIN', 'RH'] },
    { label: 'Holerite',              description: 'Consulta e envio de holerites',  icon: 'pi pi-file',        link: '/rh/holerit',                       accent: 'navy',   roles: ['ADMIN', 'RH'] },
    { label: 'Funcionários',          description: 'Cadastro e dados da equipe',     icon: 'pi pi-users',       link: '/rh/employees',                     accent: 'purple', roles: ['ADMIN', 'RH', 'MARKETING'] },
    { label: 'Clientes',              description: 'Base de clientes da empresa',    icon: 'pi pi-id-card',     link: '/company/customers',                accent: 'teal',   roles: ['ADMIN', 'RH', 'MARKETING'] },
    { label: 'Recibos de Locação',    description: 'Geração de recibos',             icon: 'pi pi-file-export', link: '/finance/rent-receipt-generator',   accent: 'green',  roles: ['ADMIN', 'FINANCEIRO'] },
    { label: 'Abastecimento',         description: 'Controle de combustível',        icon: 'pi pi-gauge',       link: '/company/fuel-supply',              accent: 'amber',  roles: ['ADMIN', 'COMPRADOR'] },
    { label: 'Equipamentos',          description: 'Inventário de equipamentos',     icon: 'pi pi-wrench',      link: '/company/equipments',               accent: 'red',    roles: ['ADMIN', 'CONTRATOS', 'MARKETING', 'DESIGN'] },
    { label: 'Newsletter',            description: 'Comunicados e novidades',        icon: 'pi pi-envelope',    link: '/communication/newsletter',         accent: 'red',    roles: ['ADMIN', 'MARKETING'] },
    { label: 'Disparo de E-mails',    description: 'Envio de e-mails em massa',      icon: 'pi pi-send',        link: '/communication/email',              accent: 'navy',   roles: ['ADMIN', 'MARKETING', 'RH', 'SUPPORT', 'DESIGN'] },
    { label: 'Remover Senha do Excel',description: 'Desbloqueio de planilhas',       icon: 'pi pi-unlock',      link: '/company/excel',                    accent: 'green'  },
    { label: 'Administração',         description: 'Central de administração',       icon: 'pi pi-shield',      link: '/settings/admin',                   accent: 'purple', roles: ['ADMIN'] },
  ];
}
