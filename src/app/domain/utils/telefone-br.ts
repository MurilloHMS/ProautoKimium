// ═══════════════════════════════════════════════════════════════════════════
// Telefone brasileiro
//
// A máscara vai se montando enquanto se digita, e trabalha só com os dígitos:
// tudo que não é número é descartado. É isso que a torna idempotente — passar
// `(11) 95778-2766` de volta devolve a mesma coisa — e é disso que depende
// poder chamá-la a cada tecla sem ela brigar com o que ela mesma escreveu.
// ═══════════════════════════════════════════════════════════════════════════

/** DDD + nove dígitos. Acima disso é engano de digitação, e o excesso cai. */
const MAXIMO_DE_DIGITOS = 11;

export function mascararTelefone(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, MAXIMO_DE_DIGITOS);
  if (!digitos) return '';

  const ddd = digitos.slice(0, 2);
  if (digitos.length <= 2) return `(${ddd}`;

  const resto = digitos.slice(2);

  // O corte muda com o total, e não com um oito fixo: fixo tem quatro dígitos
  // antes do traço, celular tem cinco. Cravar um dos dois deixa o outro torto
  // enquanto se digita.
  const antesDoTraco = digitos.length <= 10 ? 4 : 5;

  if (resto.length <= antesDoTraco) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, antesDoTraco)}-${resto.slice(antesDoTraco)}`;
}

/** Só os dígitos, para quem precisar guardar ou comparar. */
export function apenasDigitosDoTelefone(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, MAXIMO_DE_DIGITOS);
}

/**
 * Um telefone brasileiro tem 10 (fixo) ou 11 (celular) dígitos.
 *
 * Não valida DDD nem o nono dígito: recusar um DDD novo porque a lista aqui
 * está velha é pior que aceitar um número torto.
 */
export function telefoneCompleto(texto: string): boolean {
  const digitos = apenasDigitosDoTelefone(texto);
  return digitos.length === 10 || digitos.length === 11;
}
