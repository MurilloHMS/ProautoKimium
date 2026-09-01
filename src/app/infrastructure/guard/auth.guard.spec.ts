import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Observable, isObservable, firstValueFrom } from 'rxjs';

import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { PermissionStore } from '../state/permission.store';
import { environment } from '../../../environments/environment';

/**
 * A porta de cada tela.
 *
 * Errar aqui não é um bug pequeno: ou tranca gente que devia entrar, ou deixa
 * entrar quem não devia. E o modo de falha mais desagradável é o terceiro — a
 * **corrida**: decidir antes de as permissões chegarem barra todo mundo no
 * primeiro clique, uma vez, de forma intermitente.
 */
describe('AuthGuard', () => {
  let guard: AuthGuard;
  let auth: jasmine.SpyObj<AuthService>;
  let http: HttpTestingController;
  let router: Router;

  const url = `${environment.apiUrl}/me/permissions`;

  const rota = (screen?: string) =>
    ({ data: screen ? { screen } : {} }) as unknown as ActivatedRouteSnapshot;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'isLoggedIn', 'getUserRoles', 'logout', 'getRefreshToken', 'guardarSessao',
    ]);
    auth.isLoggedIn.and.returnValue(true);
    // Sem refresh guardado por padrão: cada teste que quer renovação diz isso.
    auth.getRefreshToken.and.returnValue(null);
    auth.getUserRoles.and.returnValue(['USER']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    });

    guard = TestBed.inject(AuthGuard);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  /** Roda o guard e resolve, seja ele síncrono ou não. */
  const decidir = async (screen?: string, mapa?: Record<string, string[]>) => {
    const resultado = guard.canActivate(rota(screen));
    if (!isObservable(resultado)) return resultado;

    const promessa = firstValueFrom(resultado);
    if (mapa !== undefined) http.expectOne(url).flush(mapa);
    return promessa;
  };

  // ─── Antes de qualquer permissão ──────────────────────────────────────────

  it('sem login, manda para o login', async () => {
    auth.isLoggedIn.and.returnValue(false);

    expect(await decidir('rh/hub')).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  /**
   * **O cliente é checado antes das permissões, e não depois.**
   *
   * Ele não participa deste sistema: não tem linha em `user_permissions`. Se a
   * checagem viesse depois, ele cairia no mapa vazio e veria "acesso negado"
   * em vez de voltar para o portal dele.
   */
  it('cliente volta para o portal, sem consultar permissão', async () => {
    auth.getUserRoles.and.returnValue(['CLIENTE']);

    expect(await decidir('rh/hub')).toBeFalse();
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/cliente']);
    http.expectNone(url);
  });

  // ─── A decisão ────────────────────────────────────────────────────────────

  /**
   * **A corrida.**
   *
   * As permissões chegam por HTTP depois do login, e o guard roda no primeiro
   * clique. Se ele decidisse na hora, decidiria com o mapa vazio — barrando
   * todo mundo uma vez, de forma intermitente. Este teste prova que ele espera:
   * a resposta só é enviada DEPOIS de o guard ter sido chamado.
   */
  it('espera as permissões chegarem antes de decidir', async () => {
    const resultado = guard.canActivate(rota('rh/hub'));

    expect(isObservable(resultado)).toBeTrue();

    const promessa = firstValueFrom(resultado as never);
    http.expectOne(url).flush({ 'rh/hub': ['CONSULTAR'] });

    expect(await promessa).toBeTrue();
  });

  it('sem permissão na tela, manda para acesso negado', async () => {
    expect(await decidir('stock/movements', { 'rh/hub': ['CONSULTAR'] })).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });

  /**
   * Qualquer uma das sete abre a tela — não só `CONSULTAR`. É o técnico que
   * lança um reembolso sem poder ver os dos outros.
   */
  it('abre a tela com qualquer permissão', async () => {
    expect(await decidir('documentos/rh/reimbursements',
      { 'documentos/rh/reimbursements': ['INCLUIR'] })).toBeTrue();
  });

  /**
   * Rota sem `screen` não participa do controle: a de acesso negado, as
   * notificações, o início. Trancá-las deixaria a pessoa sem nem o aviso.
   */
  it('rota sem screen passa, e mesmo assim carrega as permissões', async () => {
    expect(await decidir(undefined, {})).toBeTrue();
  });

  /**
   * **O bug de 2026-08-26, e é por isso que este teste existe.**
   *
   * Depois do login a primeira rota é `/home`, que não declara tela. Com o
   * `if (!screen) return true` na frente do `ensureLoaded`, o guard devolvia
   * `true` sem nunca carregar — e o menu ficava vazio para sempre, inclusive
   * para o admin.
   *
   * O teste anterior a este chegou a AFIRMAR o comportamento errado
   * (`http.expectNone`), o que mostra o quanto ele parecia razoável.
   */
  it('carrega as permissões mesmo na rota que não participa do controle', () => {
    const resultado = guard.canActivate(rota(undefined));

    // Precisa assinar: o observable é frio, e quem assina de verdade é o
    // Router. Sem isto a requisição não sai nem no código certo.
    (resultado as Observable<boolean>).subscribe();

    // Se o guard tivesse voltado antes, não haveria requisição para casar.
    // Afirmado no método e não só no `expectOne`: este é o teste de um bug que
    // já aconteceu, e ele não pode passar por acidente.
    const requisicao = http.expectOne(url);
    expect(requisicao.request.method).toBe('GET');

    requisicao.flush({ 'rh/hub': ['CONSULTAR'] });
  });

  // ─── Token vencido não é sessão perdida ────────────────────────────────────
  //
  // O `isLoggedIn` só lê a data do JWT, sem falar com ninguém, e navegar não
  // dispara requisição — então o interceptor nunca vê este caminho. Antes disto,
  // clicar num item de menu depois de duas horas caía direto na tela de senha,
  // que é o caminho mais comum de todos num ERP.

  /**
   * **O buraco que este conserto fecha.**
   *
   * Renovar aqui é o que faz a sessão de sete dias valer para quem navega, e não
   * só para quem dispara requisições.
   */
  it('token vencido com refresh guardado renova e deixa entrar', async () => {
    auth.isLoggedIn.and.returnValue(false);
    auth.getRefreshToken.and.returnValue('refresh-bom');

    const resultado = guard.canActivate(rota('rh/hub'));
    const promessa = firstValueFrom(resultado as Observable<boolean>);

    http.expectOne(`${environment.apiUrl}/auth/refresh`)
        .flush({ token: 'token-novo', refreshToken: 'refresh-novo' });
    http.expectOne(url).flush({ 'rh/hub': ['CONSULTAR'] });

    expect(await promessa).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalledWith(['/login']);
  });

  /**
   * Renovação recusada é a palavra final — o refresh venceu, foi revogado, ou a
   * API detectou reuso. Aí sim a pessoa precisa entrar de novo.
   */
  it('renovação recusada manda para o login', async () => {
    auth.isLoggedIn.and.returnValue(false);
    auth.getRefreshToken.and.returnValue('refresh-velho');

    const resultado = guard.canActivate(rota('rh/hub'));
    const promessa = firstValueFrom(resultado as Observable<boolean>);

    http.expectOne(`${environment.apiUrl}/auth/refresh`)
        .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(await promessa).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  /**
   * Depois de renovar, as MESMAS checagens de acesso valem. Sem isto, renovar
   * seria um desvio das regras — a pessoa entraria em tela que não pode.
   */
  it('renovar não pula a checagem de permissão', async () => {
    auth.isLoggedIn.and.returnValue(false);
    auth.getRefreshToken.and.returnValue('refresh-bom');

    const resultado = guard.canActivate(rota('rh/hub'));
    const promessa = firstValueFrom(resultado as Observable<boolean>);

    http.expectOne(`${environment.apiUrl}/auth/refresh`)
        .flush({ token: 'token-novo', refreshToken: 'refresh-novo' });
    http.expectOne(url).flush({});   // sem a tela no mapa

    expect(await promessa).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/unauthorized']);
  });
});
