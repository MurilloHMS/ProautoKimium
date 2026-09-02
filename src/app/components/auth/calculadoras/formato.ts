/**
 * Formatação das calculadoras.
 *
 * A leitura e a máscara moram em `domain/utils/decimal-br`, junto com os
 * testes; aqui ficam só as casas decimais de cada campo e o dinheiro.
 */
import { formatarDecimal } from '../../../domain/utils/decimal-br';

export { lerDecimal } from '../../../domain/utils/decimal-br';

/** Dinheiro tem centavo; km/l e porcentagem se resolvem numa casa. */
export const CASAS_DINHEIRO = 2;
export const CASAS_CONSUMO = 1;
export const CASAS_PERCENTUAL = 1;

export function reais(valor: number): string {
  return `R$ ${formatarDecimal(valor, CASAS_DINHEIRO)}`;
}

export function percentual(valor: number, casas = CASAS_PERCENTUAL): string {
  return `${formatarDecimal(valor, casas)}%`;
}
