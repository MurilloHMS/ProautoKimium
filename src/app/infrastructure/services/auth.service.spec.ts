import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

import { providersDeTeste } from '../../../testing/test-setup';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── Sair de verdade ───────────────────────────────────────────────────────

  const URL_LOGOUT = `${environment.apiUrl}/auth/logout`;

  /**
   * **O teste que faz "Sair" significar alguma coisa.**
   *
   * O `logout()` local apaga o que está nesta máquina e o refresh token continua
   * valendo sete dias do outro lado. Isso não é encerrar sessão — é esconder a
   * chave.
   */
  it('sair avisa o servidor e limpa o navegador', () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('refresh_token', 'refresh-bom');
    const http = TestBed.inject(HttpTestingController);

    service.logoutRemoto().subscribe();

    const req = http.expectOne(URL_LOGOUT);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-bom' });
    req.flush(null);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  /**
   * Rede fora não pode prender quem quer sair. O refresh sobrevive até vencer
   * sozinho, e isso é melhor do que uma pessoa presa numa tela.
   */
  it('sair limpa o navegador mesmo se o servidor falhar', () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('refresh_token', 'refresh-bom');
    const http = TestBed.inject(HttpTestingController);

    service.logoutRemoto().subscribe();
    http.expectOne(URL_LOGOUT).flush({}, { status: 500, statusText: 'Server Error' });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  /** Sem refresh guardado não há o que avisar — sai direto, sem ir à rede. */
  it('sem refresh token, sair não chama o servidor', () => {
    localStorage.setItem('token', 'jwt');
    const http = TestBed.inject(HttpTestingController);

    service.logoutRemoto().subscribe();

    http.expectNone(URL_LOGOUT);
    expect(localStorage.getItem('token')).toBeNull();
  });
});
