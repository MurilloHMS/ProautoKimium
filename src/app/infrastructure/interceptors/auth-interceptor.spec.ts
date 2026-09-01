import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { AuthInterceptor, PARAM_SESSAO_EXPIRADA } from './auth-interceptor';
import { AuthService } from '../services/auth.service';
import { ClientAuthService } from '../services/client/client-auth.service';

import { environment } from '../../../environments/environment';

/**
 * O interceptor de autenticação.
 *
 * **O defeito que ele fecha.** O token dura duas horas e o interceptor só
 * anexava; o `401` caía nas telas, e dezoito componentes diferentes traduziam
 * cada um o seu para "Faça login novamente". Uma tela que dispara cinco
 * requisições ao abrir produzia cinco avisos, ninguém era deslogado e ninguém
 * era levado a lugar nenhum — a pessoa colecionava mensagens até desistir.
 *
 * Estes testes afirmam sobre o NÚMERO de reações, e não só sobre a reação: o
 * defeito nunca foi "não acontece nada", foi "acontece cinco vezes".
 */
describe('AuthInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let auth: AuthService;
  let clientAuth: ClientAuthService;

  const URL_ERP = `${environment.apiUrl}/machines`;
  const URL_CLIENTE = `${environment.apiUrl}/client/pedidos`;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    clientAuth = TestBed.inject(ClientAuthService);

    spyOn(auth, 'logout');
    spyOn(clientAuth, 'logout');
  });

  afterEach(() => mock.verify());

  const responder401 = (url: string) =>
    mock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

  // ─── O token certo para cada sessão ────────────────────────────────────────

  /**
   * Duas sessões coexistem no mesmo navegador: o funcionário no ERP e o cliente
   * no portal. Mandar o token errado vaza a sessão do portal para telas que não
   * são dela.
   */
  it('manda o token do ERP fora de /client/ e o do cliente dentro', () => {
    spyOn(auth, 'getToken').and.returnValue('token-erp');
    spyOn(clientAuth, 'getToken').and.returnValue('token-cliente');

    http.get(URL_ERP).subscribe();
    expect(mock.expectOne(URL_ERP).request.headers.get('Authorization')).toBe('Bearer token-erp');

    http.get(URL_CLIENTE).subscribe();
    expect(mock.expectOne(URL_CLIENTE).request.headers.get('Authorization')).toBe('Bearer token-cliente');
  });

  // ─── Sessão expirada ───────────────────────────────────────────────────────

  it('401 desloga e leva para o login, avisando que expirou', () => {
    spyOn(auth, 'getToken').and.returnValue('token-velho');

    http.get(URL_ERP).subscribe();
    responder401(URL_ERP);

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledOnceWith(
      ['/login'], { queryParams: { [PARAM_SESSAO_EXPIRADA]: 1 } });
  });

  /**
   * **O teste do defeito relatado.**
   *
   * Cinco requisições em voo quando o token vence são cinco `401` no mesmo
   * instante. Sem a trava seriam cinco logouts, cinco navegações e cinco
   * mensagens — que é literalmente o que ele descreveu.
   */
  it('vários 401 ao mesmo tempo produzem UMA reação só', () => {
    spyOn(auth, 'getToken').and.returnValue('token-velho');

    for (let i = 0; i < 5; i++) http.get(URL_ERP).subscribe();
    mock.match(URL_ERP).forEach(r => r.flush({}, { status: 401, statusText: 'Unauthorized' }));

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  /**
   * Só a sessão que caiu. O funcionário perder o ERP não é motivo para
   * desconectar o cliente que estava no portal no mesmo navegador.
   */
  it('401 no portal não derruba a sessão do ERP', () => {
    spyOn(clientAuth, 'getToken').and.returnValue('token-cliente');

    http.get(URL_CLIENTE).subscribe();
    responder401(URL_CLIENTE);

    expect(clientAuth.logout).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledOnceWith(
      ['/cliente/login'], { queryParams: { [PARAM_SESSAO_EXPIRADA]: 1 } });
  });

  /**
   * **Engolido de propósito.**
   *
   * Sessão expirada não é erro de tela. Repassando, cada uma das dezoito telas
   * que traduz `401` para "Faça login novamente" mostraria a própria mensagem —
   * a mesma pilha de avisos de antes, agora com um redirecionamento junto.
   */
  it('o erro não chega na tela', () => {
    spyOn(auth, 'getToken').and.returnValue('token-velho');
    let recebeuErro = false;

    http.get(URL_ERP).subscribe({ error: () => (recebeuErro = true) });
    responder401(URL_ERP);

    expect(recebeuErro).toBeFalse();
  });

  // ─── O que NÃO é sessão expirada ───────────────────────────────────────────

  /**
   * **A exclusão que evita um defeito pior que o original.**
   *
   * O `401` do login significa "senha errada". Tratado como sessão expirada,
   * digitar a senha errada recarregaria a tela de login sem dizer o que houve —
   * e o erro nunca chegaria ao componente que sabe explicar.
   */
  it('401 no login passa direto para a tela', () => {
    let recebeuErro = false;

    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe({ error: () => (recebeuErro = true) });
    mock.expectOne(`${environment.apiUrl}/auth/login`)
        .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(recebeuErro).toBeTrue();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  /**
   * `403` é "você não pode isto", e o controle de acesso por tela depende dessa
   * distinção. Confundir os dois deslogaria quem apenas abriu uma tela sem
   * permissão.
   */
  it('403 não é sessão expirada', () => {
    spyOn(auth, 'getToken').and.returnValue('token-bom');
    let recebeuErro = false;

    http.get(URL_ERP).subscribe({ error: () => (recebeuErro = true) });
    mock.expectOne(URL_ERP).flush({}, { status: 403, statusText: 'Forbidden' });

    expect(recebeuErro).toBeTrue();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
