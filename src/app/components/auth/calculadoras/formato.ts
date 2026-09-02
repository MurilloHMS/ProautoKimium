/**
 * Entrada e saída de número das calculadoras.
 *
 * Fica fora dos componentes porque as duas telas formatam igual — e porque a
 * terceira calculadora, quando vier, vai formatar igual também.
 */

/**
 * Aceita a vírgula: o teclado do celular oferece uma, e um campo que recusa
 * `3,79` obriga a pessoa a descobrir sozinha que ali só entra ponto.
 */
export function numeroDigitado(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function percentual(valor: number, casas = 1): string {
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}
