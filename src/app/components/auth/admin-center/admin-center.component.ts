import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { TabDirtyCheck } from '../../../infrastructure/routing/tab-dirty-check';
import { PermissionStore } from '../../../infrastructure/state/permission.store';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminTemplatesComponent } from './admin-templates/admin-templates.component';
import { AdminScreensComponent } from './admin-screens/admin-screens.component';

export const ADMIN_SCREEN = 'settings/admin';

type Aba = 'usuarios' | 'telas' | 'modelos';

const ABAS: Aba[] = ['usuarios', 'telas', 'modelos'];

/**
 * A administração: contas, o que cada uma acessa, e os modelos de acesso.
 *
 * Eram três telas (Admin, Permissões por usuário, Modelos de permissão), e quem
 * queria "dar estoque ao Ricardo" passava por duas delas. Desde 2026-10-08 é
 * uma tela só, e as rotas antigas redirecionam para cá. As abas: Usuários (o
 * que cada pessoa pode), Telas (quem pode cada tela, só leitura) e Modelos.
 *
 * A casca só cuida da barra e das abas; cada aba é um componente. A aba vive na
 * URL (`?aba=modelos`, `?usuario=login`) para o link de outra tela cair no
 * lugar certo e o voltar do navegador funcionar.
 */
@Component({
  selector: 'app-admin-center',
  standalone: true,
  imports: [ToastModule, PkButtonComponent, AdminUsersComponent, AdminTemplatesComponent, AdminScreensComponent],
  templateUrl: './admin-center.component.html',
  styleUrl: './admin-center.component.scss',
  providers: [MessageService],
})
export class AdminCenterComponent implements TabDirtyCheck {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionStore);

  private readonly usersTab = viewChild(AdminUsersComponent);
  private readonly templatesTab = viewChild(AdminTemplatesComponent);

  readonly aba = signal<Aba>(abaDaUrl(this.route.snapshot.queryParamMap.get('aba')));
  /** A conta que a aba Usuários abre ao montar: a do link, ou a escolhida na aba Telas. */
  readonly usuarioAberto = signal(this.route.snapshot.queryParamMap.get('usuario'));

  readonly userCount = signal<number | null>(null);
  readonly templateCount = signal<number | null>(null);
  readonly screenCount = signal<number | null>(null);

  readonly canCreate = computed(() => this.permissions.can(ADMIN_SCREEN, 'INCLUIR'));

  isTabDirty(): boolean {
    return !!(this.usersTab()?.isTabDirty() || this.templatesTab()?.isTabDirty());
  }

  trocarAba(aba: Aba, usuario: string | null = null): void {
    if (aba === this.aba()) return;
    if (this.isTabDirty() && !confirm('Há alterações não salvas. Trocar de aba descarta.')) return;
    this.usuarioAberto.set(usuario);
    this.aba.set(aba);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: aba === 'usuarios' ? null : aba, usuario },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Da aba Telas: abre a conta da pessoa na aba Usuários, onde o acesso se muda. */
  abrirUsuario(login: string): void {
    this.trocarAba('usuarios', login);
  }

  novo(): void {
    if (this.aba() === 'usuarios') this.usersTab()?.openCreate();
    else this.templatesTab()?.openNew();
  }
}

function abaDaUrl(valor: string | null): Aba {
  return ABAS.includes(valor as Aba) ? valor as Aba : 'usuarios';
}
