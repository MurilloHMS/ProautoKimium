import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { AnnouncementService } from '../../../infrastructure/services/hr/announcement.service';
import { Announcement } from '../../../domain/models/hr/announcement.model';

interface QuickLink {
  label: string;
  description: string;
  icon: string;
  link: string;
  accent: 'navy' | 'teal' | 'amber' | 'green' | 'purple' | 'red';
  roles?: string[];
}

/**
 * Home da área autenticada.
 *
 * **Ela era uma página de administrador.** Dos doze atalhos, dez tinham trava
 * de papel — quem não é ADMIN/RH/MARKETING abria o portal e via dois cartões.
 * E existem onze telas liberadas a qualquer funcionário: holerite, férias,
 * reembolso, atestado, avisos, perfil. Nenhuma delas estava aqui.
 *
 * Agora são dois grupos. **Para você** aparece para todo mundo, sempre.
 * **Gestão** é o que já existia, e continua filtrado por papel — quem não tem
 * papel nenhum simplesmente não vê esse bloco, em vez de ver uma página vazia.
 *
 * **O que mudou vem primeiro.** Notificações e avisos do RH ocupam a faixa de
 * cima, meia página cada, e os atalhos ficam abaixo. Antes as notificações
 * eram a última seção: a informação mais perecível era a que exigia mais
 * rolagem. No celular a ordem é a mesma — notificações, avisos, atalhos.
 */
@Component({
  selector: 'app-auth-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './auth-home.component.html',
  styleUrl: './auth-home.component.scss',
})
export class AuthHomeComponent implements OnInit {

  private readonly announcementService = inject(AnnouncementService);

  readonly currentDate = new Date();

  constructor(
    public auth: AuthService,
    public notifications: NotificationService,
  ) {}

  // ─── Avisos do RH ─────────────────────────────────────────────────────────

  readonly avisos = signal<Announcement[]>([]);
  readonly avisosCarregando = signal(true);
  readonly avisosComErro = signal(false);

  readonly avisosRecentes = computed(() => this.avisos().slice(0, 4));

  ngOnInit(): void {
    // O mural é aberto a qualquer funcionário autenticado — não precisa de
    // papel, e é por isso que serve à home de todo mundo.
    this.announcementService.getAll().subscribe({
      next: (lista) => {
        this.avisos.set(lista ?? []);
        this.avisosCarregando.set(false);
      },
      error: () => {
        this.avisosComErro.set(true);
        this.avisosCarregando.set(false);
      },
    });
  }

  // ─── Saudação ─────────────────────────────────────────────────────────────

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
    this.notifications.notifications().slice(0, 5)
  );

  // ─── Atalhos ──────────────────────────────────────────────────────────────

  /** Sem trava de papel: toda a empresa usa, e é o que sustenta a home de quem não é gestor. */
  readonly PERSONAL_LINKS: QuickLink[] = [
    { label: 'Holerites',    description: 'Seus demonstrativos de pagamento', icon: 'pi pi-receipt',       link: '/documentos/holerites' ,               accent: 'navy'   },
    { label: 'Férias',       description: 'Solicitar e acompanhar',           icon: 'pi pi-sun',           link: '/documentos/rh/vacation-requests',     accent: 'amber'  },
    { label: 'Reembolsos',   description: 'Enviar nota e acompanhar',         icon: 'pi pi-wallet',        link: '/documentos/rh/reimbursements',        accent: 'green'  },
    { label: 'Atestados',    description: 'Enviar atestado médico',           icon: 'pi pi-heart',         link: '/documentos/rh/medical-certificates',  accent: 'red'    },
    { label: 'Meus documentos', description: 'Documentos pessoais de RH',     icon: 'pi pi-folder-open',   link: '/documentos/rh/documents',             accent: 'teal'   },
    { label: 'Avisos do RH', description: 'Mural de comunicados',             icon: 'pi pi-megaphone',     link: '/documentos/rh/announcements',         accent: 'purple' },
    { label: 'Documentos',   description: 'Arquivos e materiais da equipe',   icon: 'pi pi-folder',        link: '/documentos',                          accent: 'navy'   },
    { label: 'Meu perfil',   description: 'Seus dados e vCard',               icon: 'pi pi-user',          link: '/perfil',                              accent: 'teal'   },
  ];

  get managementLinks(): QuickLink[] {
    return this.MANAGEMENT_LINKS.filter(
      l => !l.roles?.length || this.auth.hasRole(l.roles)
    );
  }

  private readonly MANAGEMENT_LINKS: QuickLink[] = [
    { label: 'Portal de Vagas',       description: 'Vagas e candidaturas',           icon: 'pi pi-briefcase',   link: '/rh/painel-de-vagas',               accent: 'teal',   roles: ['ADMIN', 'RH'] },
    { label: 'Holerite (envio)',      description: 'Conferir e publicar holerites',  icon: 'pi pi-file',        link: '/rh/holerit',                       accent: 'navy',   roles: ['ADMIN', 'RH'] },
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
