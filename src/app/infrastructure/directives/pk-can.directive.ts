import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';

import { PermissionStore } from '../state/permission.store';

/**
 * Mostra o elemento só se a pessoa tiver a permissão.
 *
 * ```html
 * <pk-button *pkCan="'stock/movements:EXCLUIR'" pkLabel="Excluir" />
 * ```
 *
 * É a peça que faz o controle **por ação** existir na tela. Antes disto não
 * havia nada parecido: só a galeria escondia algo, com um `isAdmin` cravado no
 * componente.
 *
 * **A tela e a API têm que concordar.** Botão visível com endpoint negado vira
 * 403 na cara de quem clicou — e o 403 não diz qual permissão faltou. Por isso
 * o código aqui é o mesmo da authority: `tela:ACAO`, copiável de um lado para o
 * outro sem tradução.
 */
@Directive({
  selector: '[pkCan]',
  standalone: true,
})
export class PkCanDirective {

  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionStore);

  /** `'stock/movements:EXCLUIR'`, ou só `'stock/movements'` para a tela toda. */
  readonly pkCan = input.required<string>();

  private rendered = false;

  constructor() {
    // `effect` e não `ngOnInit`: as permissões chegam por HTTP depois que a
    // tela já montou. Sem reagir, o botão ficaria escondido para sempre em
    // quem abriu a página antes da resposta chegar.
    effect(() => {
      const allowed = this.permissions.canByCode(this.pkCan());

      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
