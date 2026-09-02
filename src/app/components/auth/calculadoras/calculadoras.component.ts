import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { PkInputComponent } from '../../theme/ProautoKimium/pk-input/pk-input.component';
import {
  compararCombustiveis,
  RENDIMENTO_RELATIVO_DO_ALCOOL,
  type ResultadoCombustivel,
} from '../../../domain/utils/combustivel';
import { calcularCmv, type CampoCalculado, type ResultadoCmv } from '../../../domain/utils/cmv';

/**
 * As duas calculadoras da aba Documentos.
 *
 * Nenhuma chama a API: são contas de aritmética, e mantê-las no navegador é o
 * que faz elas funcionarem no celular, no pátio, sem sinal.
 */
@Component({
  selector: 'app-calculadoras',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, PkInputComponent],
  templateUrl: './calculadoras.component.html',
  styleUrl: './calculadoras.component.scss',
})
export class CalculadorasComponent {

  readonly rendimentoRelativo = RENDIMENTO_RELATIVO_DO_ALCOOL * 100;

  // ── Combustível ─────────────────────────────────────────────────────────
  // Os campos guardam texto porque é o que o `pk-input` entrega: a conversão
  // acontece num lugar só, no `numero()`.
  readonly precoAlcool = signal('');
  readonly precoGasolina = signal('');
  readonly kmAlcool = signal('');
  readonly kmGasolina = signal('');

  readonly resultadoCombustivel = computed<ResultadoCombustivel | null>(() =>
    compararCombustiveis({
      precoAlcool: numero(this.precoAlcool()),
      precoGasolina: numero(this.precoGasolina()),
      kmPorLitroAlcool: numero(this.kmAlcool()),
      kmPorLitroGasolina: numero(this.kmGasolina()),
    }),
  );

  readonly rotuloVencedor = computed(() => {
    switch (this.resultadoCombustivel()?.vencedor) {
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

  // ── CMV ─────────────────────────────────────────────────────────────────
  readonly custo = signal('');
  readonly venda = signal('');
  readonly cmv = signal('');

  /**
   * Qual campo a tela preenche. Começa no CMV porque é o que a maioria quer
   * saber, e muda sozinho quando alguém digita justamente nele.
   */
  readonly campoCalculado = signal<CampoCalculado>('cmv');

  readonly resultadoCmv = computed<ResultadoCmv | null>(() =>
    calcularCmv(
      {
        custo: numero(this.custo()),
        venda: numero(this.venda()),
        cmvPercentual: numero(this.cmv()),
      },
      this.campoCalculado(),
    ),
  );

  /**
   * Digitar no campo que hoje é o calculado passa o cálculo para outro — é o
   * que dispensa três modos separados e um seletor para escolher entre eles.
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

  /** O que aparece na caixa do campo calculado, já formatado. */
  valorDe(campo: CampoCalculado): string {
    if (campo !== this.campoCalculado()) return this[campo]();

    const r = this.resultadoCmv();
    if (!r) return '';
    return campo === 'cmv' ? r.cmvPercentual.toFixed(1) : r[campo].toFixed(2);
  }

  limparCmv(): void {
    this.custo.set('');
    this.venda.set('');
    this.cmv.set('');
    this.campoCalculado.set('cmv');
  }

  // ── Formatação ──────────────────────────────────────────────────────────
  reais(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  percentual(valor: number, casas = 1): string {
    return `${valor.toLocaleString('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    })}%`;
  }
}

/**
 * Aceita a vírgula: o teclado do celular oferece uma, e um campo que recusa
 * `3,79` obriga a pessoa a descobrir sozinha que ali só entra ponto.
 */
function numero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}
