import { calcularLinha, totaisDaLista } from './cmv-lista';
import type { ProdutoCmv } from '../models/sankhya/produto-cmv.model';

/**
 * A lista de produtos da calculadora de CMV.
 *
 * A conta de cada linha é a mesma de sempre — `custo ÷ venda` —, então ela
 * reusa `calcularCmv`. O que é novo aqui é o comportamento da **lista**: linha
 * sem venda preenchida, produto sem custo calculado, e o que os totais fazem
 * com essas duas.
 *
 * **Três em cada quatro produtos da base têm custo zero** (3.484 de 4.632), e
 * zero dividido por qualquer venda dá zero — um resultado que parece resposta
 * e não é. Por isso a linha sem custo não calcula nada.
 */
describe('CMV em lista', () => {

  const produto = (custo: number): ProdutoCmv =>
    ({ codigo: 1075, nome: 'PROAUTO SHAMPORIZADOR', unidade: 'UN', custo });

  // ─── Uma linha ────────────────────────────────────────────────────────────

  it('calcula o CMV da linha a partir da venda digitada', () => {
    const linha = calcularLinha({ produto: produto(5348.57), venda: '7900,00' });

    expect(linha!.cmvPercentual).toBeCloseTo(67.7, 1);
    expect(linha!.margem).toBeCloseTo(2551.43, 2);
  });

  it('sem venda digitada, a linha não calcula — e não é erro', () => {
    expect(calcularLinha({ produto: produto(5348.57), venda: '' })).toBeNull();
  });

  /** **O caso dos 3.484.** Custo zero não vira CMV zero: vira "não dá". */
  it('produto sem custo calculado não produz resultado', () => {
    expect(calcularLinha({ produto: produto(0), venda: '7900,00' }))
      .withContext('zero dividido por qualquer coisa e zero, e zero pareceria resposta')
      .toBeNull();
  });

  it('venda zero também não calcula', () => {
    expect(calcularLinha({ produto: produto(5348.57), venda: '0' })).toBeNull();
  });

  /** Venda abaixo do custo é real — e precisa aparecer, não sumir. */
  it('venda abaixo do custo dá CMV acima de 100% e margem negativa', () => {
    const linha = calcularLinha({ produto: produto(1000), venda: '800' });

    expect(linha!.cmvPercentual).toBeCloseTo(125, 1);
    expect(linha!.margem).toBeCloseTo(-200, 2);
  });

  // ─── Os totais ────────────────────────────────────────────────────────────

  it('soma custo e venda só das linhas que calculam', () => {
    const totais = totaisDaLista([
      { produto: produto(5348.57), venda: '7900,00' },
      { produto: produto(3179.56), venda: '6500,00' },
      { produto: produto(1675.40), venda: '' },        // sem venda
      { produto: produto(0),       venda: '900,00' },  // sem custo
    ]);

    expect(totais.custo).toBeCloseTo(8528.13, 2);
    expect(totais.venda).toBeCloseTo(14400.00, 2);
    expect(totais.linhas)
      .withContext('duas linhas entraram; as outras duas nao tinham como')
      .toBe(2);
  });

  /**
   * **O CMV total sai da soma, não da média dos percentuais.**
   *
   * Média de percentuais trata um produto de R$ 10 igual a um de R$ 10.000.
   * O número que responde "quanto do meu faturamento é custo" é
   * `soma dos custos ÷ soma das vendas`.
   */
  it('o CMV do total é ponderado pelo valor, não é média simples', () => {
    const totais = totaisDaLista([
      { produto: produto(900),  venda: '1000' },   // CMV 90%, valores pequenos
      { produto: produto(1000), venda: '10000' },  // CMV 10%, valores grandes
    ]);

    // Media simples daria 50%. A conta certa: 1900 / 11000.
    expect(totais.cmvPercentual)
      .withContext('media simples daria 50% e trataria os dois produtos como iguais')
      .toBeCloseTo(17.27, 1);
  });

  it('lista vazia dá totais zerados, e não NaN', () => {
    const totais = totaisDaLista([]);

    expect(totais.custo).toBe(0);
    expect(totais.venda).toBe(0);
    expect(totais.cmvPercentual).toBe(0);
    expect(totais.linhas).toBe(0);
  });

  it('lista só com linhas incompletas também não vira NaN', () => {
    const totais = totaisDaLista([
      { produto: produto(1000), venda: '' },
      { produto: produto(0), venda: '500' },
    ]);

    expect(totais.cmvPercentual).toBe(0);
    expect(totais.linhas).toBe(0);
  });
});
