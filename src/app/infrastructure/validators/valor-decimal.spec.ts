import { FormControl } from '@angular/forms';

import { lerValorDoCampo, valorMinimo } from './valor-decimal';

/**
 * O validador que existe porque `Validators.min` deixou de funcionar.
 *
 * Com a máscara `pkDecimals` o campo entrega **texto** — "1.234,56" — e
 * `Number('1.234,56')` é `NaN`. Como `NaN >= 0.01` é falso, o `min` recusaria
 * todo valor. O que torna isso traiçoeiro é que com dois dígitos ("12" →
 * "0,12") a conta acerta por coincidência: o defeito só aparece no primeiro
 * valor com separador de milhar.
 */
describe('valorMinimo', () => {
  const umCentavo = valorMinimo(0.01);

  it('aceita o texto da máscara, milhar incluído', () => {
    expect(umCentavo(new FormControl('1.234,56'))).toBeNull();
    expect(umCentavo(new FormControl('0,01'))).toBeNull();
  });

  it('recusa abaixo do mínimo', () => {
    expect(umCentavo(new FormControl('0,00'))).toEqual({ min: true });
  });

  it('recusa campo vazio', () => {
    expect(umCentavo(new FormControl(''))).toEqual({ min: true });
    expect(umCentavo(new FormControl(null))).toEqual({ min: true });
  });

  it('aceita número, para o campo que ainda não usa máscara', () => {
    expect(umCentavo(new FormControl(5.5))).toBeNull();
    expect(umCentavo(new FormControl(0))).toEqual({ min: true });
  });

  it('o mínimo é configurável', () => {
    expect(valorMinimo(1)(new FormControl('0,99'))).toEqual({ min: true });
    expect(valorMinimo(1)(new FormControl('1,00'))).toBeNull();
  });
});

describe('lerValorDoCampo', () => {

  it('lê o texto da máscara', () => {
    expect(lerValorDoCampo('1.234,56')).toBe(1234.56);
    expect(lerValorDoCampo('0,37')).toBe(0.37);
  });

  /**
   * O campo carregado do banco chega como número — 3000, ou 3000.5. Passar
   * esse número pela leitura de texto destruiria o valor: `String(3000.5)` é
   * "3000.5", e ali o ponto é separador de milhar, virando 30005. Dez vezes
   * maior, num campo de salário.
   */
  it('deixa número em paz, inclusive com casas decimais', () => {
    expect(lerValorDoCampo(3000)).toBe(3000);
    expect(lerValorDoCampo(3000.5)).toBe(3000.5);
  });

  it('vazio é nulo', () => {
    expect(lerValorDoCampo('')).toBeNull();
    expect(lerValorDoCampo(null)).toBeNull();
    expect(lerValorDoCampo(undefined)).toBeNull();
  });
});
