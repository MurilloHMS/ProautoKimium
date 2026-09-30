import { apenasDigitos } from '../../../infrastructure/validators/documento-br';
import {
  CatalogCustomer, CatalogProduct, ChecklistCatalog, PriceSource, TABELA_GERAL,
} from '../../models/sales/checklist.model';
import { normalizar } from './checklist-regras';

/**
 * O catálogo do celular com os índices montados uma vez: busca de cliente e
 * de produto sem internet, e o preço de cada produto para o cliente.
 *
 * Os 6.850 clientes cabem em memória com folga; montar o texto de busca uma
 * vez, e não a cada tecla, é o que deixa a busca instantânea num celular fraco.
 */
export interface CatalogoIndexado {
  catalogo: ChecklistCatalog;
  clientes: { cliente: CatalogCustomer; texto: string; documento: string }[];
  produtos: Map<number, CatalogProduct>;
  /** Produtos de venda e revenda: os que entram no pedido e em "produtos usados". */
  vendaveis: { produto: CatalogProduct; texto: string }[];
  /** tabela → produto → preço */
  precos: Map<number, Map<number, number>>;
  comodato: { item: ChecklistCatalog['comodato'][number]; texto: string }[];
}

export function indexar(catalogo: ChecklistCatalog): CatalogoIndexado {
  const produtos = new Map(catalogo.products.map(p => [p.code, p]));
  const precos = new Map<number, Map<number, number>>();
  for (const p of catalogo.prices) {
    let tabela = precos.get(p.table);
    if (!tabela) precos.set(p.table, tabela = new Map());
    tabela.set(p.product, p.price);
  }
  return {
    catalogo,
    clientes: catalogo.customers.map(c => ({
      cliente: c,
      texto: normalizar(`${c.name} ${c.legalName ?? ''} ${c.code}`),
      documento: apenasDigitos(c.document ?? ''),
    })),
    produtos,
    vendaveis: catalogo.products
      .filter(p => p.usage === 'V' || p.usage === 'R')
      .map(p => ({ produto: p, texto: normalizar(`${p.name} ${p.code}`) })),
    precos,
    comodato: catalogo.comodato
      .filter(c => c.active)
      .map(c => ({ item: c, texto: normalizar(`${c.popularName ?? ''} ${c.name} ${c.productCode}`) })),
  };
}

/** Todas as palavras digitadas precisam aparecer, em qualquer ordem. */
function casa(texto: string, termos: string[]): boolean {
  return termos.every(t => texto.includes(t));
}

function termosDe(busca: string): string[] {
  return normalizar(busca).split(' ').filter(Boolean);
}

/**
 * Clientes pelo nome, razão social, código ou CNPJ (com ou sem pontuação).
 * Começa em 2 letras: com 1, a lista seria metade da base.
 */
export function buscarClientes(indice: CatalogoIndexado, busca: string, limite = 20): CatalogCustomer[] {
  const termos = termosDe(busca);
  const digitos = apenasDigitos(busca);
  if (!termos.length || normalizar(busca).length < 2) return [];
  const achados: CatalogCustomer[] = [];
  for (const c of indice.clientes) {
    const porDocumento = digitos.length >= 5 && c.documento.includes(digitos);
    if (porDocumento || casa(c.texto, termos)) {
      achados.push(c.cliente);
      if (achados.length >= limite) break;
    }
  }
  return achados;
}

export function buscarVendaveis(indice: CatalogoIndexado, busca: string, limite = 25): CatalogProduct[] {
  const termos = termosDe(busca);
  if (!termos.length) return [];
  return indice.vendaveis.filter(v => casa(v.texto, termos)).slice(0, limite).map(v => v.produto);
}

/** Comodato pelo nome do dia a dia ("dosador frigorífico") ou pelo técnico. Vazio = a lista toda. */
export function buscarComodato(indice: CatalogoIndexado, busca: string): ChecklistCatalog['comodato'] {
  const termos = termosDe(busca);
  return indice.comodato.filter(c => !termos.length || casa(c.texto, termos)).map(c => c.item);
}

// ─── Preço ──────────────────────────────────────────────────────────────────

export interface PrecoDoProduto {
  preco: number;
  tabela: number;
  origem: PriceSource;
}

/**
 * O preço do produto para o cliente: a tabela dele primeiro, a geral (80) para
 * o que ela não tem. Cliente sem tabela ou novo: só a 80 (decisão dele,
 * 2026-09-29). Nulo quando o produto não está em nenhuma das duas.
 */
export function precoPara(indice: CatalogoIndexado, produto: number, tabelaDoCliente: number | null): PrecoDoProduto | null {
  if (tabelaDoCliente !== null && tabelaDoCliente !== TABELA_GERAL) {
    const preco = indice.precos.get(tabelaDoCliente)?.get(produto);
    if (preco !== undefined) return { preco, tabela: tabelaDoCliente, origem: 'CLIENTE' };
  }
  const geral = indice.precos.get(TABELA_GERAL)?.get(produto);
  return geral === undefined ? null : { preco: geral, tabela: TABELA_GERAL, origem: 'GERAL' };
}

/**
 * Os produtos que o pedido oferece: os da tabela do cliente primeiro (a lista
 * negociada, que é o que ele costuma comprar), depois os da geral. Com busca,
 * filtra; sem busca, mostra só os da tabela do cliente — a geral inteira seria
 * uma lista que ninguém percorre no celular.
 */
export function produtosDoPedido(indice: CatalogoIndexado, tabelaDoCliente: number | null, busca: string): { produto: CatalogProduct; preco: PrecoDoProduto }[] {
  const termos = termosDe(busca);
  const resultado: { produto: CatalogProduct; preco: PrecoDoProduto }[] = [];
  for (const v of indice.vendaveis) {
    if (termos.length && !casa(v.texto, termos)) continue;
    const preco = precoPara(indice, v.produto.code, tabelaDoCliente);
    if (!preco) continue;
    if (!termos.length && preco.origem !== 'CLIENTE') continue;
    resultado.push({ produto: v.produto, preco });
  }
  resultado.sort((a, b) =>
    a.preco.origem === b.preco.origem ? a.produto.name.localeCompare(b.produto.name) : a.preco.origem === 'CLIENTE' ? -1 : 1);
  return resultado.slice(0, 40);
}
