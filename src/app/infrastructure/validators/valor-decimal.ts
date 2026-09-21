import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { lerDecimal } from '../../domain/utils/decimal-br';

/**
 * Mínimo para um campo com a máscara `pkDecimals`.
 *
 * **`Validators.min` não serve nesses campos.** A máscara entrega texto em
 * português — "1.234,56" — e `Number('1.234,56')` é `NaN`. Como toda comparação
 * com `NaN` é falsa, o `min` recusaria qualquer valor. E o defeito é
 * traiçoeiro: com dois dígitos ("12" → "0,12") a conta acerta por
 * coincidência, então ele só aparece no primeiro valor com separador de
 * milhar — normalmente na frente de quem usa, não de quem escreveu.
 *
 * Aceita número também: campo que ainda não ganhou a máscara continua
 * funcionando, e a troca pode ser feita uma tela por vez.
 */
export function valorMinimo(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const bruto = control.value;
    const valor = typeof bruto === 'number' ? bruto : lerDecimal(String(bruto ?? ''));
    return valor !== null && valor >= minimo ? null : { min: true };
  };
}

/**
 * O valor de um campo com máscara, como número, para mandar à API.
 *
 * **Número passa direto, de propósito.** O campo carregado do banco chega
 * numérico — 3000, ou 3000.5 — e ali o ponto é decimal. Se esse número fosse
 * pela leitura do texto em português, onde o ponto é separador de milhar,
 * 3000.5 viraria 30005: dez vezes maior, num campo de salário, sem erro nenhum
 * na tela.
 */
export function lerValorDoCampo(bruto: unknown): number | null {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : null;
  return lerDecimal(String(bruto ?? ''));
}
