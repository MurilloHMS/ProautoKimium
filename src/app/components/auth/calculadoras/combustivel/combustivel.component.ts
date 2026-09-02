import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { calculadora } from '../calculadoras.catalog';
import { numeroDigitado, reais, percentual } from '../formato';
import {
  compararCombustiveis,
  RENDIMENTO_RELATIVO_DO_ALCOOL,
  type ResultadoCombustivel,
} from '../../../../domain/utils/combustivel';

/**
 * Álcool ou gasolina.
 *
 * Não chama a API: é aritmética, e manter a conta no navegador é o que faz a
 * tela funcionar no celular, no pátio, sem sinal.
 */
@Component({
  selector: 'app-calculadora-combustivel',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, PkInputComponent],
  templateUrl: './combustivel.component.html',
  styleUrl: './combustivel.component.scss',
})
export class CombustivelComponent {

  /** Título e descrição saem do catálogo, os mesmos que o hub mostra no cartão. */
  readonly calc = calculadora('combustivel');
  readonly rendimentoRelativo = RENDIMENTO_RELATIVO_DO_ALCOOL * 100;

  // Os campos guardam texto porque é o que o `pk-input` entrega; a conversão
  // acontece num lugar só.
  readonly precoAlcool = signal('');
  readonly precoGasolina = signal('');
  readonly kmAlcool = signal('');
  readonly kmGasolina = signal('');

  readonly resultado = computed<ResultadoCombustivel | null>(() =>
    compararCombustiveis({
      precoAlcool: numeroDigitado(this.precoAlcool()),
      precoGasolina: numeroDigitado(this.precoGasolina()),
      kmPorLitroAlcool: numeroDigitado(this.kmAlcool()),
      kmPorLitroGasolina: numeroDigitado(this.kmGasolina()),
    }),
  );

  readonly rotuloVencedor = computed(() => {
    switch (this.resultado()?.vencedor) {
      case 'alcool': return 'Álcool';
      case 'gasolina': return 'Gasolina';
      case 'empate': return 'Tanto faz';
      default: return '';
    }
  });

  limparConsumo(): void {
    this.kmAlcool.set('');
    this.kmGasolina.set('');
  }

  readonly reais = reais;
  readonly percentual = percentual;
}
