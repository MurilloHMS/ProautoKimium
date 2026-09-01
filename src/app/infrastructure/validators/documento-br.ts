import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * CPF e CNPJ: máscara e validação.
 *
 * **A máscara sozinha não basta.** `111.111.111-11` tem onze dígitos e o
 * formato certo, e não é documento de ninguém. Num formulário que abre o
 * WhatsApp do comercial, o que passa daqui vira o cadastro de um cliente — e
 * conferir dígito verificador é a diferença entre pedir o documento e só pedir
 * onze números.
 *
 * O dígito verificador é aritmética fechada: os dois últimos números saem dos
 * anteriores. Errar um dígito ao digitar quase sempre quebra a conta, então o
 * mesmo cálculo que barra invenção também pega tecla trocada.
 */

/** Só os dígitos, no limite do maior dos dois documentos. */
export function apenasDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '').slice(0, 14);
}

/**
 * Formata conforme o tamanho: até onze dígitos é CPF, acima é CNPJ.
 *
 * A troca acontece no décimo segundo dígito, e é o que permite um campo só. A
 * alternativa seria um seletor "CPF/CNPJ" antes do campo — uma decisão a mais
 * para quem só quer pedir um orçamento, e que a contagem resolve sozinha.
 */
export function formatarDocumento(valor: string): string {
  const d = apenasDigitos(valor);

  if (d.length <= 11) {
    // 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  // 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/**
 * O dígito verificador, que é o mesmo cálculo nos dois documentos com pesos
 * diferentes: soma ponderada, resto por 11, e resto menor que 2 vira zero.
 */
function digitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, i) => total + Number(digitos[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11) return false;

  // `111.111.111-11` e os outros repetidos passam na conta do dígito
  // verificador — é uma sequência válida por acidente da aritmética, e é
  // justamente o que alguém digita para escapar do campo.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const primeiro = digitoVerificador(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  return primeiro === Number(d[9]) && segundo === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const primeiro = digitoVerificador(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return primeiro === Number(d[12]) && segundo === Number(d[13]);
}

/**
 * Validador de formulário: aceita um CPF **ou** um CNPJ.
 *
 * Campo vazio devolve `null` de propósito. Quem decide se é obrigatório é o
 * `Validators.required` ao lado — misturar as duas coisas faria o campo
 * opcional reclamar de vazio no dia em que alguém tirasse o `required`.
 */
export function documentoBr(control: AbstractControl): ValidationErrors | null {
  const d = apenasDigitos(control.value ?? '');
  if (!d) return null;

  return cpfValido(d) || cnpjValido(d) ? null : { documentoBr: true };
}
