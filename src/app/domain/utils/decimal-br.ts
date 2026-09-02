// ═══════════════════════════════════════════════════════════════════════════
// Número decimal em português
//
// No Brasil a vírgula separa os decimais, e um campo que só aceita ponto
// obriga a pessoa a digitar contra o próprio teclado. Aqui a máscara vai
// preenchendo as casas da direita para a esquerda enquanto se digita — como
// numa maquininha de cartão: 3 vira 0,03, 37 vira 0,37, 379 vira 3,79.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Formata os dígitos de `texto` com `casas` decimais.
 *
 * Só os dígitos importam: tudo que não for número é descartado, o que faz a
 * função ser idempotente — passar `'3,79'` de volta devolve `'3,79'`. É disso
 * que depende poder chamá-la a cada tecla sem a máscara brigar com ela mesma.
 */
export function mascararDecimal(texto: string, casas: number): string {
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return '';

  // Sem isto, apagar tudo e digitar de novo acumularia zeros à esquerda:
  // '0,03' de volta na máscara viraria '003' e cresceria a cada tecla.
  const semZerosAEsquerda = digitos.replace(/^0+(?=\d)/, '');
  const preenchido = semZerosAEsquerda.padStart(casas + 1, '0');

  const corte = preenchido.length - casas;
  const inteiro = agruparMilhares(preenchido.slice(0, corte));
  if (casas === 0) return inteiro;

  return `${inteiro},${preenchido.slice(corte)}`;
}

/**
 * O caminho de volta: texto em português vira número.
 *
 * O ponto é separador de milhar aqui, não de decimal — `'1.234,56'` é mil
 * duzentos e trinta e quatro, e não um vírgula dois.
 */
export function lerDecimal(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Um número vira o texto que a máscara produziria para ele.
 *
 * Sai igual à máscara de propósito: o campo calculado do CMV é preenchido por
 * aqui e depois pode ser digitado por cima, e os dois caminhos precisam
 * concordar sobre como o valor se escreve.
 */
export function formatarDecimal(valor: number, casas: number): string {
  const sinal = valor < 0 ? '-' : '';
  const emCentavos = Math.round(Math.abs(valor) * 10 ** casas).toString();
  return sinal + mascararDecimal(emCentavos.padStart(casas + 1, '0'), casas);
}

function agruparMilhares(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
