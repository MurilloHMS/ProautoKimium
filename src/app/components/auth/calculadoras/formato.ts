/**
 * Formatação das calculadoras.
 *
 * A leitura e a máscara moram em `domain/utils/decimal-br`, junto com os
 * testes; aqui ficam só as casas decimais de cada campo e o dinheiro.
 */
import { formatarDecimal } from '../../../domain/utils/decimal-br';

export { lerDecimal } from '../../../domain/utils/decimal-br';

/** Dinheiro tem centavo; km/l se resolve numa casa. */
export const CASAS_DINHEIRO = 2;
export const CASAS_CONSUMO = 1;

/**
 * O CMV entra e sai com duas casas: meio ponto percentual sobre o custo de um
 * item que gira muito é dinheiro que aparece no fim do mês.
 *
 * O preço é na digitação — 50% passa a ser `5000`, quatro teclas. É o mesmo
 * acordo de qualquer campo de dinheiro, e vale a troca porque o número aqui é
 * usado para decidir preço, e não só para conferir.
 */
export const CASAS_CMV = 2;

export function reais(valor: number): string {
  return `R$ ${formatarDecimal(valor, CASAS_DINHEIRO)}`;
}

export function percentual(valor: number, casas = 1): string {
  return `${formatarDecimal(valor, casas)}%`;
}
