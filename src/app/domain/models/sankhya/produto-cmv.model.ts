/**
 * Um produto do ERP com o custo já calculado, para a tela de CMV.
 *
 * Vem de `AD_CMVPROD` cruzada com o cadastro de produtos. Medido em
 * 2026-09-08: são 4.632 produtos, e **3.484 deles têm `custo` zero** — o que
 * ali significa "ainda não calculado", não "de graça".
 */
export interface ProdutoCmv {
  codigo: number;
  nome: string;
  /** UN, LT, KG — como o ERP registra. */
  unidade: string;
  custo: number;
}

/**
 * Custo zero não dá para calcular CMV: a conta é `custo ÷ venda`, e zero
 * dividido por qualquer coisa é zero — um resultado que parece resposta e não
 * é. Por isso a tela marca e bloqueia, em vez de deixar somar.
 */
export function temCustoCalculado(produto: ProdutoCmv): boolean {
  return Number.isFinite(produto.custo) && produto.custo > 0;
}

/** Uma linha da tabela: o produto escolhido mais a venda que a pessoa digitou. */
export interface LinhaCmv {
  produto: ProdutoCmv;
  /** O que foi digitado, ainda como texto — a formatação é da tela. */
  venda: string;
}
