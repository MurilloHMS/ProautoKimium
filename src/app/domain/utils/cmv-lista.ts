// ═══════════════════════════════════════════════════════════════════════════
// CMV de vários produtos de uma vez
//
// A conta de cada linha é a mesma de sempre — `custo = venda × CMV` — então
// reusa `calcularCmv`. O que é novo aqui é o comportamento da LISTA: o que
// fazer com linha sem venda, com produto sem custo, e como somar tudo.
// ═══════════════════════════════════════════════════════════════════════════

import { calcularCmv, type ResultadoCmv } from './cmv';
import { lerDecimal } from '../../components/auth/calculadoras/formato';
import { temCustoCalculado, type LinhaCmv } from '../models/sankhya/produto-cmv.model';

export interface TotaisDaLista {
  custo: number;
  venda: number;
  cmvPercentual: number;
  /** Quantas linhas entraram na conta — as outras ficam de fora, não zeradas. */
  linhas: number;
}

/**
 * O resultado de uma linha, ou `null` quando ainda não dá para calcular.
 *
 * **Duas situações devolvem `null`, e nenhuma é erro.** Venda ainda não
 * digitada é o estado normal de quem monta uma lista aos poucos. Produto sem
 * custo calculado é o caso dos 3.484 da base — e ali zero não pode virar
 * "CMV 0%", que pareceria uma resposta boa.
 */
export function calcularLinha(linha: LinhaCmv): ResultadoCmv | null {
  if (!temCustoCalculado(linha.produto)) return null;

  return calcularCmv(
    {
      custo: linha.produto.custo,
      venda: lerDecimal(linha.venda),
      cmvPercentual: null,
    },
    'cmv',
  );
}

/**
 * Soma o que dá para somar.
 *
 * **O CMV do total é ponderado pelo valor, e não a média dos percentuais.**
 * Média simples trataria um produto de R$ 10 igual a um de R$ 10.000. A
 * pergunta que o rodapé responde é "quanto do faturamento desta lista é
 * custo", e isso é `soma dos custos ÷ soma das vendas`.
 */
export function totaisDaLista(linhas: LinhaCmv[]): TotaisDaLista {
  let custo = 0;
  let venda = 0;
  let contadas = 0;

  for (const linha of linhas) {
    const resultado = calcularLinha(linha);
    if (!resultado) continue;

    custo += resultado.custo;
    venda += resultado.venda;
    contadas++;
  }

  return {
    custo,
    venda,
    cmvPercentual: venda > 0 ? (custo / venda) * 100 : 0,
    linhas: contadas,
  };
}
