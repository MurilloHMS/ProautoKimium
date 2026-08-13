import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Superfície de conteúdo — título, dica e um canto para ações.
 *
 * Existe porque quatro hubs (RH, Máquinas, Estoque, Abastecimento) repetem o
 * mesmo bloco `.card` + `.card__title` + `.card__hint` em CSS próprio, cada um
 * com a sua cópia. Aqui é um só, e o dark mode vem junto porque tudo é token.
 *
 * O `.app-card` global continua valendo para caixa simples sem cabeçalho; este
 * componente é para quando há título, dica ou ação.
 */
@Component({
  selector: 'pk-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pk-card.component.html',
  styleUrl: './pk-card.component.scss',
})
export class PkCardComponent {

  title = input<string>('');
  hint = input<string>('');
  icon = input<string>('');

  /** `flush` tira o respiro interno: para tabela ou lista que já tem o seu. */
  flush = input<boolean>(false);
}
