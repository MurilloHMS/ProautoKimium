import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PkKpiTone = 'default' | 'success' | 'warning' | 'danger';

/**
 * Indicador de topo — rótulo, número grande, unidade e uma linha de apoio.
 *
 * O bloco existe copiado em quatro hubs com nomes diferentes (`.kpi`, `.stat`,
 * `.m-stats`). Aqui vira um só, e o valor chega **já formatado**: quem sabe se
 * é moeda, litro ou hora é a tela, não o componente.
 *
 * `loading` mostra um traço no lugar do número. Zero e "carregando" são coisas
 * diferentes, e um painel que mostra 0 antes de responder mente por um segundo.
 */
@Component({
  selector: 'pk-kpi',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pk-kpi.component.html',
  styleUrl: './pk-kpi.component.scss',
})
export class PkKpiComponent {

  label = input.required<string>();
  value = input.required<string | number>();

  /** Sufixo pequeno colado no número: "km/l", "litros", "un". */
  unit = input<string>('');

  /** Linha de apoio abaixo do número. */
  sub = input<string>('');

  icon = input<string>('');
  tone = input<PkKpiTone>('default');

  /** Destaque: o indicador que a tela quer que seja lido primeiro. */
  hero = input<boolean>(false);

  loading = input<boolean>(false);
}
