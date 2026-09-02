import { calcularCmv } from './cmv';

describe('calcularCmv', () => {

  it('tira o CMV do custo e da venda', () => {
    // O exemplo que originou a tela: 2,25 de custo, 4,50 de venda.
    const r = calcularCmv({ custo: 2.25, venda: 4.50, cmvPercentual: null }, 'cmv')!;
    expect(r.cmvPercentual).toBeCloseTo(50, 6);
  });

  it('tira a venda do custo e do CMV', () => {
    const r = calcularCmv({ custo: 2.25, venda: null, cmvPercentual: 50 }, 'venda')!;
    expect(r.venda).toBeCloseTo(4.50, 6);
  });

  it('tira o custo da venda e do CMV', () => {
    const r = calcularCmv({ custo: null, venda: 4.50, cmvPercentual: 50 }, 'custo')!;
    expect(r.custo).toBeCloseTo(2.25, 6);
  });

  it('separa markup de CMV', () => {
    // Os mesmos dois números: 50% de CMV e 100% de markup. Se algum dia
    // alguém "simplificar" achando que são a mesma conta, cai aqui.
    const r = calcularCmv({ custo: 2.25, venda: 4.50, cmvPercentual: null }, 'cmv')!;
    expect(r.cmvPercentual).toBeCloseTo(50, 6);
    expect(r.markupPercentual).toBeCloseTo(100, 6);
    expect(r.margem).toBeCloseTo(2.25, 6);
  });

  it('ignora o campo calculado que veio preenchido', () => {
    // O valor velho do CMV não pode influenciar o CMV novo.
    const r = calcularCmv({ custo: 2.00, venda: 8.00, cmvPercentual: 50 }, 'cmv')!;
    expect(r.cmvPercentual).toBeCloseTo(25, 6);
  });

  it('devolve margem negativa quando o CMV passa de 100%', () => {
    const r = calcularCmv({ custo: 5.00, venda: 4.00, cmvPercentual: null }, 'cmv')!;
    expect(r.cmvPercentual).toBeCloseTo(125, 6);
    expect(r.margem).toBeCloseTo(-1, 6);
    expect(r.markupPercentual).toBeLessThan(0);
  });

  it('espera enquanto faltar um dos dois campos digitados', () => {
    expect(calcularCmv({ custo: 2.25, venda: null, cmvPercentual: null }, 'cmv')).toBeNull();
    expect(calcularCmv({ custo: null, venda: null, cmvPercentual: 50 }, 'venda')).toBeNull();
  });

  it('não divide por zero', () => {
    expect(calcularCmv({ custo: 2.25, venda: 0, cmvPercentual: null }, 'cmv')).toBeNull();
    expect(calcularCmv({ custo: 2.25, venda: null, cmvPercentual: 0 }, 'venda')).toBeNull();
  });
});
