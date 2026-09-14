import { Component, HostListener, input, output } from '@angular/core';

/**
 * Folha que sobe de baixo, para editar no celular.
 *
 * Extraída da Programação (`stock/programacao`) quando a segunda tela — o
 * cadastro de eventos — pediu a mesma coisa, como a skill previa. A receita e as
 * medidas estão lá, escolhidas por ele no aparelho: **82dvh** de altura e **16px**
 * de raio em cima. A Programação ainda usa a cópia dela; migrar é um passo à
 * parte, com os testes de lá.
 *
 * ```html
 * <pk-sheet [open]="aberto()" title="Editar evento" (closed)="fechar()">
 *   <div pkSheetBody>…campos…</div>
 *   <div pkSheetFooter>…botões…</div>
 * </pk-sheet>
 * ```
 *
 * **A projeção é por atributo, e o `@if` vai dentro do slot, nunca em volta.**
 * Com o `@if` por fora, o slot tem mais de um nó na raiz e o Angular não projeta
 * nada — a folha abre vazia, com build verde (NG8011 é só aviso).
 *
 * Por que não `pk-dialog`: o diálogo do tema nasce centralizado por contrato, e
 * no celular o centro deixa o conteúdo longe do polegar.
 */
@Component({
  selector: 'pk-sheet',
  standalone: true,
  templateUrl: './pk-sheet.component.html',
  styleUrl: './pk-sheet.component.scss',
})
export class PkSheetComponent {
  readonly open = input(false);
  readonly title = input('');
  /** Folha sobre outra folha (1060 contra 1050), decidido por número e não por ordem no HTML. */
  readonly stacked = input(false);

  readonly closed = output<void>();

  fechar(): void {
    this.closed.emit();
  }

  /** `Esc` fecha. Com duas abertas, só a de cima reage — a de baixo vê a de cima e espera. */
  @HostListener('document:keydown.escape')
  aoEsc(): void {
    if (!this.open()) return;
    if (!this.stacked() && document.querySelector('.pk-sheet--sobreposta')) return;
    this.fechar();
  }
}
