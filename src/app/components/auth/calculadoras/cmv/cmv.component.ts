import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { calculadora } from '../calculadoras.catalog';
import { numeroDigitado, reais, percentual } from '../formato';
import { calcularCmv, type CampoCalculado, type ResultadoCmv } from '../../../../domain/utils/cmv';

/**
 * CMV — custo da mercadoria vendida.
 *
 * Três campos e um deles é o resultado: custo, venda e percentual são faces da
 * mesma relação, então três modos separados seriam a mesma conta escrita três
 * vezes.
 */
@Component({
  selector: 'app-calculadora-cmv',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, PkInputComponent],
  templateUrl: './cmv.component.html',
  styleUrl: './cmv.component.scss',
})
export class CmvComponent {

  /** Título e descrição saem do catálogo, os mesmos que o hub mostra no cartão. */
  readonly calc = calculadora('cmv');

  readonly custo = signal('');
  readonly venda = signal('');
  readonly cmv = signal('');

  /**
   * Qual campo a tela preenche. Começa no CMV porque é o que a maioria quer
   * saber, e muda sozinho quando alguém digita justamente nele.
   */
  readonly campoCalculado = signal<CampoCalculado>('cmv');

  readonly resultado = computed<ResultadoCmv | null>(() =>
    calcularCmv(
      {
        custo: numeroDigitado(this.custo()),
        venda: numeroDigitado(this.venda()),
        cmvPercentual: numeroDigitado(this.cmv()),
      },
      this.campoCalculado(),
    ),
  );

  /**
   * Digitar no campo que hoje é o calculado passa o cálculo para outro — é o
   * que dispensa um seletor de modo.
   *
   * O destino é o CMV, salvo quando é nele que se está digitando: aí o
   * calculado vira o preço de venda, que é a outra pergunta que alguém faz de
   * pé na frente do cliente.
   */
  aoDigitar(campo: CampoCalculado, valor: string): void {
    this[campo].set(valor);
    if (this.campoCalculado() === campo) {
      this.campoCalculado.set(campo === 'cmv' ? 'venda' : 'cmv');
    }
  }

  /** O que aparece na caixa: o texto digitado, ou o resultado já formatado. */
  valorDe(campo: CampoCalculado): string {
    if (campo !== this.campoCalculado()) return this[campo]();

    const r = this.resultado();
    if (!r) return '';
    return campo === 'cmv' ? r.cmvPercentual.toFixed(1) : r[campo].toFixed(2);
  }

  limpar(): void {
    this.custo.set('');
    this.venda.set('');
    this.cmv.set('');
    this.campoCalculado.set('cmv');
  }

  readonly reais = reais;
  readonly percentual = percentual;
}
