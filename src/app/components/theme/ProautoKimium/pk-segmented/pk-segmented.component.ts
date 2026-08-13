import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PkSegmentedOption {
  label: string;
  value: any;
  disabled?: boolean;
}

/**
 * Alternador de um valor entre poucas opções — período, escopo, recorte.
 *
 * É o seletor de mês do design da Área do Cliente (Mai · Jun · Jul · Ago) e
 * serve também para os "7 / 30 / 90 dias" que os hubs internos escrevem à mão.
 *
 * Não é `ControlValueAccessor` de propósito: isto controla o estado de uma
 * tela, não um campo de formulário. `[(value)]` funciona pelo par
 * `value`/`valueChange`, sem trazer o peso de um campo junto.
 *
 * Para muitas opções, use `pk-combobox` — uma tira com dez botões não cabe em
 * celular e vira rolagem horizontal escondida.
 */
@Component({
  selector: 'pk-segmented',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pk-segmented.component.html',
  styleUrl: './pk-segmented.component.scss',
})
export class PkSegmentedComponent {

  options = input<PkSegmentedOption[]>([]);
  value = input<any>(null);

  /** Ocupa a largura toda, dividindo igualmente — o padrão no celular. */
  fill = input<boolean>(false);

  size = input<'sm' | 'md'>('md');
  ariaLabel = input<string>('');

  valueChange = output<any>();

  select(option: PkSegmentedOption): void {
    if (option.disabled || option.value === this.value()) return;
    this.valueChange.emit(option.value);
  }
}
