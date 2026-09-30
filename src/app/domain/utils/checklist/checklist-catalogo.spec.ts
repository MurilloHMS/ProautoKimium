import { catalogoDeTeste } from '../../../../testing/checklist-fixtures';
import { buscarClientes, buscarComodato, indexar, precoPara, produtosDoPedido } from './checklist-catalogo';

describe('checklist-catalogo', () => {
  const indice = indexar(catalogoDeTeste());

  it('acha cliente pelo nome sem acento, pelo código e pelo CNPJ com pontuação', () => {
    expect(buscarClientes(indice, 'padaria sao').map(c => c.code)).toEqual([5000]);
    expect(buscarClientes(indice, 'central unid').map(c => c.code)).toEqual([3661]);
    expect(buscarClientes(indice, '3661').map(c => c.code)).toEqual([3661]);
    expect(buscarClientes(indice, '11.222.333/0001').map(c => c.code)).toEqual([3661]);
    expect(buscarClientes(indice, 'p')).withContext('uma letra só não busca').toEqual([]);
  });

  it('preço: a tabela do cliente primeiro, a geral (80) para o que ela não tem', () => {
    expect(precoPara(indice, 197, 281)).toEqual({ preco: 9.5, tabela: 281, origem: 'CLIENTE' });
    expect(precoPara(indice, 455, 281)).toEqual({ preco: 35.31, tabela: 80, origem: 'GERAL' });
    expect(precoPara(indice, 197, null)).withContext('sem tabela: só a 80').toEqual({ preco: 10.98, tabela: 80, origem: 'GERAL' });
    expect(precoPara(indice, 900, 281)).withContext('sem preço em nenhuma').toBeNull();
  });

  it('o pedido sem busca mostra só a lista negociada; com busca, a geral também', () => {
    expect(produtosDoPedido(indice, 281, '').map(x => x.produto.code)).toEqual([197]);
    expect(produtosDoPedido(indice, 281, 'poseidon').map(x => x.produto.code)).toEqual([455]);
    expect(produtosDoPedido(indice, 281, 'detergente')).withContext('sem preço não entra').toEqual([]);
  });

  it('comodato acha pelo nome do dia a dia', () => {
    expect(buscarComodato(indice, 'dosador frigo').map(c => c.productCode)).toEqual([5112]);
    expect(buscarComodato(indice, '').length).toBe(2);
  });
});
