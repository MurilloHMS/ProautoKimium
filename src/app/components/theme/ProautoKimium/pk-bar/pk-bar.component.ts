import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PkBarTone = 'action' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Barra horizontal de comparação — rótulo, trilho e valor.
 *
 * O projeto desenha gráfico em CSS puro, sem biblioteca, e essa barra já existe
 * três vezes com três nomes: `.rank` no Estoque e no Abastecimento, `.dist` nas
 * Máquinas e `.dist-item` no RH. Este componente é o nome único.
 *
 * `percent` é o tamanho da barra e `value` é o texto à direita, **já
 * formatado** — a mesma barra mostra "12 un.", "R$ 1.470,00" ou "38%" sem o
 * componente precisar saber qual é.
 */
@Component({
  selector: 'pk-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pk-bar.component.html',
  styleUrl: './pk-bar.component.scss',
})
export class PkBarComponent {

  label = input.required<string>();

  /** Segunda linha do rótulo, para contexto que não cabe no nome. */
  sub = input<string>('');

  percent = input<number>(0);
  value = input<string | number>('');
  tone = input<PkBarTone>('action');

  /** Fora de 0–100 a barra vazaria o trilho ou sumiria. */
  readonly width = computed(() => Math.max(0, Math.min(100, this.percent())));
}
