import { compararCombustiveis, RENDIMENTO_RELATIVO_DO_ALCOOL } from './combustivel';

describe('compararCombustiveis', () => {

  it('não compara nada enquanto faltar um dos preços', () => {
    expect(compararCombustiveis({
      precoAlcool: 3.79, precoGasolina: null,
      kmPorLitroAlcool: null, kmPorLitroGasolina: null,
    })).toBeNull();
  });

  describe('sem km/l, pela média de mercado', () => {

    it('elege a gasolina quando o álcool passa dos 70%', () => {
      // 3,79 / 5,00 = 75,8% — acima do limite.
      const r = compararCombustiveis({
        precoAlcool: 3.79, precoGasolina: 5.00,
        kmPorLitroAlcool: null, kmPorLitroGasolina: null,
      })!;
      expect(r.vencedor).toBe('gasolina');
      expect(r.peloConsumoReal).toBeFalse();
      expect(r.precoDeEquilibrioDoAlcool).toBeCloseTo(3.50, 2);
    });

    it('elege o álcool quando ele fica abaixo dos 70%', () => {
      const r = compararCombustiveis({
        precoAlcool: 3.79, precoGasolina: 5.89,
        kmPorLitroAlcool: null, kmPorLitroGasolina: null,
      })!;
      expect(r.vencedor).toBe('alcool');
      expect(r.proporcaoDePreco).toBeCloseTo(0.643, 3);
    });

    it('não devolve custo por km — sem km/l ele não existe', () => {
      const r = compararCombustiveis({
        precoAlcool: 3.50, precoGasolina: 5.00,
        kmPorLitroAlcool: null, kmPorLitroGasolina: null,
      })!;
      expect(r.custoPorKmAlcool).toBeNull();
      expect(r.custoPorKmGasolina).toBeNull();
      expect(r.economiaPor100Km).toBeNull();
    });

    it('chama de empate o preço exatamente no equilíbrio', () => {
      const gasolina = 5.00;
      const r = compararCombustiveis({
        precoAlcool: gasolina * RENDIMENTO_RELATIVO_DO_ALCOOL, precoGasolina: gasolina,
        kmPorLitroAlcool: null, kmPorLitroGasolina: null,
      })!;
      expect(r.vencedor).toBe('empate');
    });
  });

  describe('com os dois km/l', () => {

    it('usa o consumo informado e ignora a média dos 70%', () => {
      // A 75,8% do preço, a média condenaria o álcool. Mas este carro faz
      // 9 km/l no álcool contra 11 na gasolina — razão de 81,8%, e aí ele ganha.
      // Sem esta divergência o teste passaria com a média e com o consumo.
      const r = compararCombustiveis({
        precoAlcool: 3.79, precoGasolina: 5.00,
        kmPorLitroAlcool: 9, kmPorLitroGasolina: 11,
      })!;
      expect(r.peloConsumoReal).toBeTrue();
      expect(r.vencedor).toBe('alcool');
    });

    it('devolve o custo por km e a diferença a cada 100 km', () => {
      const r = compararCombustiveis({
        precoAlcool: 4.00, precoGasolina: 6.00,
        kmPorLitroAlcool: 10, kmPorLitroGasolina: 12,
      })!;
      expect(r.custoPorKmAlcool).toBeCloseTo(0.40, 4);
      expect(r.custoPorKmGasolina).toBeCloseTo(0.50, 4);
      expect(r.economiaPor100Km).toBeCloseTo(10, 4);
    });

    it('cai na média quando só um dos km/l foi preenchido', () => {
      const r = compararCombustiveis({
        precoAlcool: 3.79, precoGasolina: 5.00,
        kmPorLitroAlcool: 9, kmPorLitroGasolina: null,
      })!;
      expect(r.peloConsumoReal).toBeFalse();
      // O km/l solto não pode vazar para o resultado.
      expect(r.custoPorKmAlcool).toBeNull();
      expect(r.vencedor).toBe('gasolina');
    });

    it('trata km/l zerado como não informado', () => {
      const r = compararCombustiveis({
        precoAlcool: 3.79, precoGasolina: 5.00,
        kmPorLitroAlcool: 0, kmPorLitroGasolina: 11,
      })!;
      expect(r.peloConsumoReal).toBeFalse();
    });
  });
});
