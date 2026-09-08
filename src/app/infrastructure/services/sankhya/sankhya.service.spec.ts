import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SankhyaService } from './sankhya.service';
import { environment } from '../../../../environments/environment';
import type { ProdutoCmv } from '../../../domain/models/sankhya/produto-cmv.model';

/**
 * A ponte entre a tela e o ERP.
 *
 * O que vale travar aqui é a **tradução**: a API repassa a resposta do Sankhya
 * como veio — colunas de um lado, matriz de valores do outro — e é este serviço
 * que transforma isso em produto com nome, unidade e custo.
 *
 * A resposta usada nos testes é a de verdade, copiada de uma consulta real à
 * base da Proauto.
 */
describe('SankhyaService', () => {

  const URL = `${environment.apiUrl}/sankhya/query`;

  let service: SankhyaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SankhyaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Formato real: nome com espaços à direita, porque a coluna é de largura fixa. */
  const RESPOSTA_REAL = {
    fieldsMetadata: [
      { name: 'CODPROD', order: 1, userType: 'I' },
      { name: 'PRODUTO', order: 2, userType: 'S' },
      { name: 'CODVOL', order: 3, userType: 'S' },
      { name: 'CMV', order: 4, userType: 'F' },
    ],
    rows: [
      [1075, 'PROAUTO SHAMPORIZADOR', 'UN', 5348.57],
      [2987, 'DILUIDOR  LIMPA BAU   ', 'UN', 3179.56],
      [4, 'MANUTENÇÃO CORRETIVA', 'UN', 0.0],
    ],
  };

  function responder(corpo: object = RESPOSTA_REAL) {
    const req = http.expectOne(URL);
    req.flush(corpo);
    return req;
  }

  it('manda o SQL no corpo, e não na URL', () => {
    service.produtosComCmv().subscribe();

    const req = responder();

    expect(req.request.method).toBe('POST');
    expect(req.request.body.query)
      .withContext('a consulta viaja no corpo — na URL ela entraria em log de acesso')
      .toContain('AD_CMVPROD');
  });

  it('a consulta cruza com o cadastro para trazer nome e unidade', () => {
    service.produtosComCmv().subscribe();

    const req = responder();

    expect(req.request.body.query).toContain('TGFPRO');
    expect(req.request.body.query)
      .withContext('DESCRPROD e coluna de largura fixa: sem RTRIM o nome vem com espaços')
      .toContain('RTRIM');
  });

  it('traduz colunas e valores em produtos', () => {
    let produtos: ProdutoCmv[] = [];
    service.produtosComCmv().subscribe(p => (produtos = p));

    responder();

    expect(produtos.length).toBe(3);
    expect(produtos[0]).toEqual({
      codigo: 1075,
      nome: 'PROAUTO SHAMPORIZADOR',
      unidade: 'UN',
      custo: 5348.57,
    });
  });

  it('tira os espaços que a coluna de largura fixa deixa', () => {
    let produtos: ProdutoCmv[] = [];
    service.produtosComCmv().subscribe(p => (produtos = p));

    responder();

    expect(produtos[1].nome)
      .withContext('o nome vem como "DILUIDOR  LIMPA BAU   " do ERP')
      .toBe('DILUIDOR  LIMPA BAU');
  });

  /**
   * Decisão dele: os zerados aparecem marcados, não somem. Então o serviço
   * entrega todos, e é a tela que distingue.
   */
  it('traz também os de custo zero', () => {
    let produtos: ProdutoCmv[] = [];
    service.produtosComCmv().subscribe(p => (produtos = p));

    responder();

    expect(produtos.length).toBe(3);
    expect(produtos[2].custo).toBe(0);
  });

  it('resultado vazio não quebra a tela', () => {
    let produtos: ProdutoCmv[] = [];
    service.produtosComCmv().subscribe(p => (produtos = p));

    responder({ fieldsMetadata: [], rows: [] });

    expect(produtos).toEqual([]);
  });
});
