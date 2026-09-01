import { FormControl } from '@angular/forms';

import { cnpjValido, cpfValido, documentoBr, formatarDocumento } from './documento-br';

/**
 * CPF e CNPJ.
 *
 * O que estes testes protegem é a diferença entre **pedir o documento** e pedir
 * onze números. Uma máscara sozinha aceita `111.111.111-11`, que tem o formato
 * certo e não é documento de ninguém — e o que passa daqui vira o cadastro de um
 * cliente do outro lado do WhatsApp.
 *
 * Os documentos usados aqui são inválidos de propósito como pessoas e válidos
 * como aritmética: os dígitos verificadores fecham, e é só isso que o código
 * conhece.
 */
describe('documento-br', () => {
  const CPF_VALIDO = '52998224725';
  const CNPJ_VALIDO = '11222333000181';

  // ─── Máscara ───────────────────────────────────────────────────────────────

  describe('formatarDocumento', () => {
    it('formata CPF conforme a pessoa digita', () => {
      expect(formatarDocumento('529')).toBe('529');
      expect(formatarDocumento('5299')).toBe('529.9');
      expect(formatarDocumento('529982')).toBe('529.982');
      expect(formatarDocumento('5299822')).toBe('529.982.2');
      expect(formatarDocumento(CPF_VALIDO)).toBe('529.982.247-25');
    });

    /**
     * **A troca acontece no décimo segundo dígito.**
     *
     * É o que permite um campo só. A alternativa seria um seletor "CPF/CNPJ"
     * antes dele — uma decisão a mais para quem só quer pedir um orçamento, e
     * que a contagem resolve sozinha.
     */
    it('vira CNPJ ao passar de onze dígitos', () => {
      expect(formatarDocumento('11222333000')).toBe('112.223.330-00');
      expect(formatarDocumento('112223330001')).toBe('11.222.333/0001');
      expect(formatarDocumento(CNPJ_VALIDO)).toBe('11.222.333/0001-81');
    });

    it('ignora o que não for dígito e para em catorze', () => {
      expect(formatarDocumento('529.982.247-25')).toBe('529.982.247-25');
      expect(formatarDocumento('abc529982247251234567')).toBe('52.998.224/7251-23');
    });

    it('vazio continua vazio', () => {
      expect(formatarDocumento('')).toBe('');
    });
  });

  // ─── Dígito verificador ────────────────────────────────────────────────────

  describe('cpfValido', () => {
    it('aceita um CPF com dígitos certos', () => {
      expect(cpfValido(CPF_VALIDO)).toBeTrue();
      expect(cpfValido('529.982.247-25')).toBeTrue();
    });

    /**
     * **O caso que a máscara sozinha deixa passar**, e o que alguém digita para
     * escapar do campo obrigatório.
     */
    it('recusa dígitos repetidos', () => {
      expect(cpfValido('11111111111')).toBeFalse();
      expect(cpfValido('00000000000')).toBeFalse();
    });

    /** Um dígito trocado quebra a conta — é o mesmo cálculo que pega erro de digitação. */
    it('recusa um dígito verificador errado', () => {
      expect(cpfValido('52998224724')).toBeFalse();
    });

    it('recusa tamanho errado', () => {
      expect(cpfValido('5299822472')).toBeFalse();
      expect(cpfValido('529982247251')).toBeFalse();
    });
  });

  describe('cnpjValido', () => {
    it('aceita um CNPJ com dígitos certos', () => {
      expect(cnpjValido(CNPJ_VALIDO)).toBeTrue();
      expect(cnpjValido('11.222.333/0001-81')).toBeTrue();
    });

    it('recusa dígitos repetidos', () => {
      expect(cnpjValido('11111111111111')).toBeFalse();
    });

    it('recusa um dígito verificador errado', () => {
      expect(cnpjValido('11222333000182')).toBeFalse();
    });
  });

  // ─── O validador do formulário ─────────────────────────────────────────────

  describe('documentoBr', () => {
    it('aceita CPF e CNPJ', () => {
      expect(documentoBr(new FormControl(CPF_VALIDO))).toBeNull();
      expect(documentoBr(new FormControl(CNPJ_VALIDO))).toBeNull();
    });

    it('recusa o que não é nenhum dos dois', () => {
      expect(documentoBr(new FormControl('11111111111'))).toEqual({ documentoBr: true });
      expect(documentoBr(new FormControl('123'))).toEqual({ documentoBr: true });
    });

    /**
     * Vazio devolve nulo de propósito: quem decide se o campo é obrigatório é o
     * `Validators.required` ao lado. Misturados, o campo opcional passaria a
     * reclamar de vazio no dia em que alguém tirasse o `required`.
     */
    it('vazio não é erro deste validador', () => {
      expect(documentoBr(new FormControl(''))).toBeNull();
      expect(documentoBr(new FormControl(null))).toBeNull();
    });
  });
});
