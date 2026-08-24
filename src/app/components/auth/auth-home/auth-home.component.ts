import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../../infrastructure/services/auth.service';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { AnnouncementService } from '../../../infrastructure/services/hr/announcement.service';
import { HomeService } from '../../../infrastructure/services/home/home.service';
import { Announcement } from '../../../domain/models/hr/announcement.model';
import { HomeSummary, PENDING_INFO, PendingItem } from '../../../domain/models/home/home-summary.model';

/**
 * Home da área autenticada — o que está esperando você.
 *
 * **Ela era um menu, e o app já navega de seis jeitos:** nav-drawer, tab-bar,
 * bottom-nav, busca da topbar, e as grades de `rh/hub`, `documentos` e
 * `documentos/rh`. A sétima grade aqui era a pior delas — sem hierarquia, sem
 * busca, e disputando o primeiro olhar com o que importa.
 *
 * Agora a página responde uma pergunta só: **o que precisa de mim?** Holerite
 * por confirmar, férias pedidas, reembolso aberto e, para gestor, as aprovações
 * paradas. Quem quer navegar usa o menu, que é melhor nisso.
 *
 * O bloco de pendências **some inteiro** quando não há nada, em vez de mostrar
 * um vazio educado ocupando meia tela. Nos dias calmos quem sustenta a página
 * são notificações e avisos, que raramente estão vazios ao mesmo tempo.
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
  private readonly homeService = inject(HomeService);

  readonly currentDate = new Date();

  constructor(
    public auth: AuthService,
    public notifications: NotificationService,
  ) {}

  // ─── Pendências ───────────────────────────────────────────────────────────

  readonly resumo = signal<HomeSummary | null>(null);
  readonly resumoCarregando = signal(true);

  readonly minhasPendencias = computed(() => this.resumo()?.mine ?? []);
  readonly aprovacoes = computed(() => this.resumo()?.approvals ?? []);
  readonly saldoFerias = computed(() => this.resumo()?.vacationBalanceDays ?? null);

  // ─── Avisos do RH ─────────────────────────────────────────────────────────

  readonly avisos = signal<Announcement[]>([]);
  readonly avisosCarregando = signal(true);
  readonly avisosComErro = signal(false);

  readonly avisosRecentes = computed(() => this.avisos().slice(0, 4));

  ngOnInit(): void {
    // Falha no resumo não mostra erro na tela: as pendências simplesmente não
    // aparecem, e a home continua servindo notificações e avisos. Uma faixa
    // vermelha na porta de entrada assusta mais do que informa, e não há nada
    // que a pessoa possa fazer a respeito.
    this.homeService.getSummary().subscribe({
      next: (r) => {
        this.resumo.set(r);
        this.resumoCarregando.set(false);
      },
      error: () => this.resumoCarregando.set(false),
    });

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

  /** Tipo desconhecido não quebra a tela: cai num ícone genérico e na home. */
  info(item: PendingItem): { icon: string; rota: string } {
    return PENDING_INFO[item.type] ?? { icon: 'pi pi-circle', rota: '/home' };
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

  readonly recentNotifications = computed(() =>
    this.notifications.notifications().slice(0, 5)
  );
}
