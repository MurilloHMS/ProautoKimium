import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Estado vazio — ícone, título e uma linha que diz o que fazer.
 *
 * O `pk-table` já tem o seu embutido; este é para tudo que não é tabela: um
 * cartão sem dado no período, uma lista de unidades sem resultado de busca.
 *
 * O subtítulo não é enfeite: "Nenhum registro" sozinho deixa o usuário sem
 * saber se está quebrado, se está carregando ou se ele é que precisa fazer
 * alguma coisa.
 */
@Component({
  selector: 'pk-empty',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pk-empty.component.html',
  styleUrl: './pk-empty.component.scss',
})
export class PkEmptyComponent {

  icon = input<string>('pi pi-inbox');
  title = input<string>('Nenhum registro encontrado');
  subtitle = input<string>('');

  /** `compact` cabe dentro de um cartão; o padrão ocupa a área toda. */
  compact = input<boolean>(false);
}
