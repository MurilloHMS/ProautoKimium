// ═══════════════════════════════════════════════════════════════════════════
// CMV — custo da mercadoria vendida
//
// Custo, venda e CMV são três faces de uma relação só: `custo = venda × CMV`.
// Sabendo dois, o terceiro sai. É por isso que a tela não tem três modos —
// tem três campos e um deles é o resultado.
// ═══════════════════════════════════════════════════════════════════════════

/** Qual dos três campos a tela calcula. Os outros dois são digitados. */
export type CampoCalculado = 'custo' | 'venda' | 'cmv';

export interface EntradaCmv {
  custo: number | null;
  venda: number | null;
  /** Em pontos percentuais: 50 quer dizer 50%, não 0,5. */
  cmvPercentual: number | null;
}

export interface ResultadoCmv {
  custo: number;
  venda: number;
  cmvPercentual: number;
  /** O que sobra por unidade, em reais. Negativa quando o CMV passa de 100%. */
  margem: number;
  /**
   * Quanto se acrescenta ao custo, e NÃO o mesmo número que o CMV.
   *
   * 2,25 → 4,50 é 50% de CMV e 100% de markup. Os dois vivem juntos aqui de
   * propósito: quem fala "markup" e lê o CMV erra o preço pela metade.
   */
  markupPercentual: number;
}

function positivo(valor: number | null): valor is number {
  return valor !== null && Number.isFinite(valor) && valor > 0;
}

/**
 * Devolve `null` enquanto os dois campos digitados não bastarem para fechar a
 * conta. O campo em `calculado` é ignorado na entrada — ele é a saída.
 *
 * CMV acima de 100% passa: é venda abaixo do custo, que acontece, e a margem
 * volta negativa dizendo isso. Recusar esconderia o prejuízo em vez de mostrá-lo.
 */
export function calcularCmv(entrada: EntradaCmv, calculado: CampoCalculado): ResultadoCmv | null {
  const { custo, venda, cmvPercentual } = entrada;

  let c: number, v: number;

  switch (calculado) {
    case 'cmv':
      if (!positivo(custo) || !positivo(venda)) return null;
      c = custo;
      v = venda;
      break;
    case 'venda':
      if (!positivo(custo) || !positivo(cmvPercentual)) return null;
      c = custo;
      v = custo / (cmvPercentual / 100);
      break;
    case 'custo':
      if (!positivo(venda) || !positivo(cmvPercentual)) return null;
      v = venda;
      c = venda * (cmvPercentual / 100);
      break;
  }

  return {
    custo: c,
    venda: v,
    cmvPercentual: (c / v) * 100,
    margem: v - c,
    markupPercentual: ((v - c) / c) * 100,
  };
}
