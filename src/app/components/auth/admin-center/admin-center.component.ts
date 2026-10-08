import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { TabDirtyCheck } from '../../../infrastructure/routing/tab-dirty-check';
import { PermissionStore } from '../../../infrastructure/state/permission.store';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminTemplatesComponent } from './admin-templates/admin-templates.component';

export const ADMIN_SCREEN = 'settings/admin';

type Aba = 'usuarios' | 'modelos';

/**
 * A administração: contas, o que cada uma acessa, e os modelos de acesso.
 *
 * Eram três telas (Admin, Permissões por usuário, Modelos de permissão), e quem
 * queria "dar estoque ao Ricardo" passava por duas delas. Desde 2026-10-08 é
 * uma tela só, com duas abas, e as rotas antigas redirecionam para cá.
 *
 * A casca só cuida da barra e das abas; cada aba é um componente. A aba vive na
 * URL (`?aba=modelos`, `?usuario=login`) para o link de outra tela cair no
 * lugar certo e o voltar do navegador funcionar.
 */
@Component({
  selector: 'app-admin-center',
  standalone: true,
  imports: [ToastModule, PkButtonComponent, AdminUsersComponent, AdminTemplatesComponent],
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

  readonly aba = signal<Aba>(this.route.snapshot.queryParamMap.get('aba') === 'modelos' ? 'modelos' : 'usuarios');
  readonly usuarioDaUrl = this.route.snapshot.queryParamMap.get('usuario');

  readonly userCount = signal<number | null>(null);
  readonly templateCount = signal<number | null>(null);

  readonly canCreate = computed(() => this.permissions.can(ADMIN_SCREEN, 'INCLUIR'));

  isTabDirty(): boolean {
    return !!(this.usersTab()?.isTabDirty() || this.templatesTab()?.isTabDirty());
  }

  trocarAba(aba: Aba): void {
    if (aba === this.aba()) return;
    if (this.isTabDirty() && !confirm('Há alterações não salvas. Trocar de aba descarta.')) return;
    this.aba.set(aba);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aba: aba === 'modelos' ? 'modelos' : null, usuario: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  novo(): void {
    if (this.aba() === 'usuarios') this.usersTab()?.openCreate();
    else this.templatesTab()?.openNew();
  }
}
