import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { isObservable, firstValueFrom, of } from 'rxjs';

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
      'isLoggedIn', 'getUserRoles', 'logout',
    ]);
    auth.isLoggedIn.and.returnValue(true);
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
  it('rota sem screen passa direto, sem consultar nada', async () => {
    expect(await decidir(undefined)).toBeTrue();
    http.expectNone(url);
  });
});
