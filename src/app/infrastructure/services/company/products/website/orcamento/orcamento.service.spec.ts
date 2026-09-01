import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { OrcamentoService } from './orcamento.service';

describe('OrcamentoService', () => {
  let service: OrcamentoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],});
    service = TestBed.inject(OrcamentoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── CPF/CNPJ ──────────────────────────────────────────────────────────────

  const CPF = '52998224725';

  const preencher = (extra: Record<string, string> = {}) => {
    service.form.patchValue({
      nome: 'Transportadora Beta',
      email: 'compras@beta.com.br',
      telefone: '11999998888',
      documento: CPF,
      segmento: 'Transporte',
      ...extra,
    });
  };

  /**
   * **O campo é obrigatório**, e é o pedido que originou tudo isto: o orçamento
   * abre o WhatsApp do comercial, e do outro lado alguém precisa saber para quem
   * está cotando.
   */
  it('o formulário não fica válido sem documento', () => {
    preencher({ documento: '' });

    expect(service.form.valid).toBeFalse();
    expect(service.form.get('documento')!.hasError('required')).toBeTrue();
  });

  /**
   * **Onze dígitos não são um CPF.**
   *
   * Sem conferir dígito verificador, o campo obrigatório só ensina a digitar
   * `11111111111` para passar da tela — e o comercial recebe um cadastro que
   * não existe.
   */
  it('documento com formato certo e dígito errado não passa', () => {
    preencher({ documento: '11111111111' });

    expect(service.form.valid).toBeFalse();
    expect(service.form.get('documento')!.hasError('documentoBr')).toBeTrue();
  });

  it('CPF e CNPJ válidos passam', () => {
    preencher({ documento: CPF });
    expect(service.form.valid).toBeTrue();

    preencher({ documento: '11222333000181' });
    expect(service.form.valid).toBeTrue();
  });

  /**
   * A mensagem leva o documento FORMATADO, embora o formulário guarde só os
   * dígitos: quem lê é uma pessoa no WhatsApp, e catorze números seguidos não se
   * conferem de olho.
   */
  it('o texto do WhatsApp mostra o documento com máscara', () => {
    const texto = decodeURIComponent(
      service.gerarTextoWhatsApp('Beta', '11999998888', 'a@b.com', 'Transporte', CPF)
    );

    expect(texto).toContain('*CPF/CNPJ:* 529.982.247-25');
  });

  /**
   * O envio não pode acontecer com o formulário inválido — é o que impede um
   * orçamento sem identificação de chegar ao comercial.
   */
  it('não abre o WhatsApp com o formulário incompleto', () => {
    const abrir = spyOn(window, 'open').and.stub();
    preencher({ documento: '' });

    service.enviarWhatsApp();

    expect(abrir).not.toHaveBeenCalled();
  });
});
