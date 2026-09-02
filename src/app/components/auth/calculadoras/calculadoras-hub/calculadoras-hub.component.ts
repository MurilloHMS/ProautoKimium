import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { CALCULADORAS } from '../calculadoras.catalog';

/**
 * Hub das calculadoras.
 *
 * O hub é só a vitrine; a conta acontece na tela de cada calculadora — mesma
 * divisão das ferramentas de PDF.
 */
@Component({
  selector: 'app-calculadoras-hub',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './calculadoras-hub.component.html',
  styleUrl: './calculadoras-hub.component.scss',
})
export class CalculadorasHubComponent {

  private readonly permissions = inject(PermissionStore);

  /**
   * Só o que a pessoa consegue abrir — o mesmo `canOpen` do hub de Documentos.
   *
   * Sem o filtro, um cartão sem permissão abriria e o guard devolveria a
   * pessoa para trás: um clique que não leva a lugar nenhum ensina a não
   * clicar mais.
   */
  readonly calculadoras = computed(() =>
    CALCULADORAS.filter(c => this.permissions.canOpen(c.routerLink[0].slice(1))));
}
