// ═══════════════════════════════════════════════════════════════════════════
// Álcool ou gasolina
//
// A conta que interessa não é o preço da bomba, é o custo do quilômetro
// rodado. Um litro de álcool rende menos que um de gasolina, então comparar
// os dois preços lado a lado responde a pergunta errada.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quanto o álcool rende em relação à gasolina, quando ninguém informou o
 * consumo do próprio carro. É a proporção de sempre — e é uma média: carro
 * nenhum é obrigado a respeitá-la.
 */
export const RENDIMENTO_RELATIVO_DO_ALCOOL = 0.7;

/**
 * Abaixo disso os dois custam a mesma coisa na prática.
 *
 * Sem a faixa, uma diferença de um centavo em cem reais elegeria um vencedor —
 * e a tela diria "compensa gasolina" para o que é empate.
 */
const TOLERANCIA_DE_EMPATE = 0.01;

export type Vencedor = 'alcool' | 'gasolina' | 'empate';

export interface EntradaCombustivel {
  precoAlcool: number | null;
  precoGasolina: number | null;
  /** Opcionais: só valem em par. Um sozinho não permite comparação nenhuma. */
  kmPorLitroAlcool: number | null;
  kmPorLitroGasolina: number | null;
}

export interface ResultadoCombustivel {
  vencedor: Vencedor;
  /**
   * `true` quando os dois km/l vieram preenchidos e a conta saiu do consumo
   * informado. `false` quando ela caiu na média dos 70% — e aí a tela precisa
   * dizer isso, senão uma estimativa passa por medição.
   */
  peloConsumoReal: boolean;
  /** Nulos fora do consumo real: sem km/l não existe custo por km. */
  custoPorKmAlcool: number | null;
  custoPorKmGasolina: number | null;
  economiaPor100Km: number | null;
  /** Quanto o álcool custa em relação à gasolina, de 0 a 1. */
  proporcaoDePreco: number;
  /** O preço em que os dois empatam. Acima disso o álcool deixa de compensar. */
  precoDeEquilibrioDoAlcool: number;
}

function positivo(valor: number | null): valor is number {
  return valor !== null && Number.isFinite(valor) && valor > 0;
}

/**
 * Devolve `null` enquanto os dois preços não estiverem preenchidos — é o
 * estado inicial da tela, não um erro.
 */
export function compararCombustiveis(entrada: EntradaCombustivel): ResultadoCombustivel | null {
  const { precoAlcool, precoGasolina, kmPorLitroAlcool, kmPorLitroGasolina } = entrada;
  if (!positivo(precoAlcool) || !positivo(precoGasolina)) return null;

  const peloConsumoReal = positivo(kmPorLitroAlcool) && positivo(kmPorLitroGasolina);

  // O mesmo cálculo serve aos dois modos, e é por isso que não há dois ramos
  // aqui: o que muda é de onde sai a razão de rendimento. Com km/l ela é
  // medida; sem, é a média de mercado.
  const razaoDeRendimento = peloConsumoReal
    ? kmPorLitroAlcool / kmPorLitroGasolina
    : RENDIMENTO_RELATIVO_DO_ALCOOL;

  const precoDeEquilibrioDoAlcool = precoGasolina * razaoDeRendimento;

  const distancia = Math.abs(precoAlcool - precoDeEquilibrioDoAlcool) / precoDeEquilibrioDoAlcool;
  let vencedor: Vencedor;
  if (distancia < TOLERANCIA_DE_EMPATE) vencedor = 'empate';
  else if (precoAlcool < precoDeEquilibrioDoAlcool) vencedor = 'alcool';
  else vencedor = 'gasolina';

  const custoPorKmAlcool = peloConsumoReal ? precoAlcool / kmPorLitroAlcool : null;
  const custoPorKmGasolina = peloConsumoReal ? precoGasolina / kmPorLitroGasolina : null;

  return {
    vencedor,
    peloConsumoReal,
    custoPorKmAlcool,
    custoPorKmGasolina,
    economiaPor100Km:
      custoPorKmAlcool !== null && custoPorKmGasolina !== null
        ? Math.abs(custoPorKmAlcool - custoPorKmGasolina) * 100
        : null,
    proporcaoDePreco: precoAlcool / precoGasolina,
    precoDeEquilibrioDoAlcool,
  };
}
