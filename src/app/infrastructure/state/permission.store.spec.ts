import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PermissionStore } from './permission.store';
import { environment } from '../../../environments/environment';

/**
 * O que a pessoa logada pode.
 *
 * O que se protege aqui não é a leitura do mapa — é o **carregamento**: uma
 * requisição só para muitos perguntadores, e o mapa disponível antes de alguém
 * decidir com base nele. Errar isso não dá erro: dá tela sumindo de forma
 * intermitente, na máquina de quem tem internet ruim.
 */
describe('PermissionStore', () => {
  let store: PermissionStore;
  let http: HttpTestingController;

  const url = `${environment.apiUrl}/me/permissions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(PermissionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const responder = (mapa: Record<string, string[]>) => {
    http.expectOne(url).flush(mapa);
  };

  // ─── O carregamento ───────────────────────────────────────────────────────

  /**
   * **Uma requisição, não cinco.**
   *
   * O menu renderiza vários itens de uma vez, e cada um pergunta. Sem
   * compartilhar a chamada em andamento, cada pergunta viraria um GET.
   */
  it('perguntas simultâneas compartilham a mesma requisição', () => {
    store.ensureLoaded().subscribe();
    store.ensureLoaded().subscribe();
    store.ensureLoaded().subscribe();

    responder({ 'rh/hub': ['CONSULTAR'] });
    // O `http.verify()` do afterEach falha se tiver sobrado requisição.
  });

  it('depois de carregado, não vai ao servidor de novo', () => {
    store.ensureLoaded().subscribe();
    responder({ 'rh/hub': ['CONSULTAR'] });

    store.ensureLoaded().subscribe();

    http.expectNone(url);
  });

  /**
   * Falhar não pode travar a navegação num erro que ninguém entende.
   *
   * Mapa vazio quer dizer "não vê nada", e a tela de acesso negado explica —
   * melhor que uma tela branca sem mensagem.
   */
  it('erro na chamada vira mapa vazio, não exceção', () => {
    let resultado: unknown = 'nao chamou';
    store.ensureLoaded().subscribe(mapa => (resultado = mapa));

    http.expectOne(url).flush('erro', { status: 500, statusText: 'Server Error' });

    expect(resultado).toEqual({});
    expect(store.loaded()).toBeTrue();
  });

  // ─── As perguntas ─────────────────────────────────────────────────────────

  /**
   * **Qualquer uma das sete abre a tela.**
   *
   * Usar `CONSULTAR` como porta fecharia um caso real: um técnico que precisa
   * *lançar* um reembolso sem poder *ver* os dos outros entra na tela e não
   * enxerga a lista.
   */
  it('abre a tela com qualquer permissão, inclusive sem CONSULTAR', () => {
    store.ensureLoaded().subscribe();
    responder({ 'documentos/rh/reimbursements': ['INCLUIR'] });

    expect(store.canOpen('documentos/rh/reimbursements')).toBeTrue();
    expect(store.can('documentos/rh/reimbursements', 'CONSULTAR')).toBeFalse();
  });

  it('tela que não veio no mapa está fechada', () => {
    store.ensureLoaded().subscribe();
    responder({ 'rh/hub': ['CONSULTAR'] });

    expect(store.canOpen('stock/movements')).toBeFalse();
    expect(store.can('stock/movements', 'CONSULTAR')).toBeFalse();
  });

  /** O código é o mesmo da authority da API — copiável de um lado ao outro. */
  it('canByCode entende tela:ACAO e tela sozinha', () => {
    store.ensureLoaded().subscribe();
    responder({ 'stock/movements': ['EXCLUIR'] });

    expect(store.canByCode('stock/movements:EXCLUIR')).toBeTrue();
    expect(store.canByCode('stock/movements:ALTERAR')).toBeFalse();
    expect(store.canByCode('stock/movements')).toBeTrue();
  });

  /**
   * **Sem isto, o próximo login herda o menu do anterior.**
   *
   * Quem entrasse depois do admin veria as telas do admin até a requisição nova
   * responder. É uma janela curta, e é exatamente nela que alguém clica.
   */
  it('clear esquece o mapa e faz buscar de novo', () => {
    store.ensureLoaded().subscribe();
    responder({ 'rh/hub': ['CONSULTAR'] });

    store.clear();

    expect(store.canOpen('rh/hub')).toBeFalse();
    store.ensureLoaded().subscribe();
    responder({});
  });
});
