import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { EMPTY, Observable, catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ClientAuthService } from '../services/client/client-auth.service';
import { Sessao, SessionRefreshService } from '../services/session-refresh.service';
import { environment } from '../../../environments/environment';

/** O que a tela de login mostra quando a sessão caiu sozinha. */
export const PARAM_SESSAO_EXPIRADA = 'expirou';

@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {

  /** Trava do redirecionamento, para vários `401` produzirem uma ida só ao login. */
  private redirecionando = false;

  constructor(
    private authService: AuthService,
    private clientAuthService: ClientAuthService,
    private router: Router,
    private sessionRefresh: SessionRefreshService,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    req = this.semServiceWorker(req);

    /**
     * Rotas que não têm sessão para expirar.
     *
     * O login precisa estar aqui pelos DOIS motivos: não tem token para mandar,
     * e o `401` dele significa "senha errada" e não "sessão caiu". Tratado como
     * os outros, digitar a senha errada deslogaria a pessoa e recarregaria a
     * tela de login sem dizer o que houve.
     *
     * O `refresh` está aqui para não se renovar a si mesmo: um `401` dele é a
     * resposta final, e tentar renovar de novo seria um laço infinito.
     */
    const rotasPublicas = [
      '/auth/login',
      '/auth/refresh',
      '/auth/first-access',
      '/auth/forgot-password',
      '/auth/reset-password',
      // Entrar com a digital: o mesmo caso do login. Cobre as duas rotas
      // (`/options` e a conclusão); o `401` delas é "a digital não
      // confirmou", e não sessão caída. O cadastro da digital NÃO está aqui:
      // quem cadastra está logado, e a API responde 400 quando recusa.
      '/auth/webauthn/authentication',
    ];

    if (rotasPublicas.some(url => req.url.includes(url))) {
      return next.handle(req);
    }

    const sessao: Sessao = req.url.includes('/client/') ? 'cliente' : 'erp';

    return next.handle(this.comToken(req, sessao)).pipe(
      catchError((erro: HttpErrorResponse) => {
        if (erro.status !== 401) return throwError(() => erro);

        return this.renovarERepetir(req, next, sessao);
      }),
    );
  }

  /**
   * Tenta renovar; conseguindo, repete a requisição que falhou.
   *
   * Repetir é o ponto: para quem está usando, o vencimento do token vira uma
   * requisição meio segundo mais lenta em vez de uma tela de login. Sem o
   * `switchMap` aqui, a renovação funcionaria e a tela ainda assim ficaria sem
   * o dado que foi buscar.
   */
  private renovarERepetir(req: HttpRequest<any>, next: HttpHandler, sessao: Sessao): Observable<HttpEvent<any>> {
    return this.sessionRefresh.renovar(sessao).pipe(
      switchMap(() => next.handle(this.comToken(req, sessao))),
      catchError(() => {
        // A renovação também falhou: o refresh venceu, foi revogado, ou nunca
        // existiu. Aqui acaba o que dá para fazer sem a pessoa.
        this.encerrarSessao(sessao);
        return EMPTY;
      }),
    );
  }

  /**
   * As chamadas da API passam por fora do service worker.
   *
   * O service worker do Angular (só no build de produção) toma conta de TODA
   * requisição da página; no Safari do iPhone, um POST com arquivo que passa
   * por ele pode chegar sem corpo. Foi o reembolso de 2026-10-08: "O parâmetro
   * 'expenseDate' é obrigatório" com tudo preenchido, e no ambiente de testes
   * (sem service worker) funcionando. A API não é cacheada pelo service worker,
   * então nada se perde.
   *
   * Parâmetro `ngsw-bypass`, e não cabeçalho: um cabeçalho novo numa chamada
   * para outro domínio dispara o CORS, e a API só aceita Authorization,
   * Content-Type, Accept e Origin — o cabeçalho derrubaria todas as chamadas.
   */
  private semServiceWorker(req: HttpRequest<any>): HttpRequest<any> {
    if (!req.url.startsWith(environment.apiUrl)) return req;
    return req.clone({ setParams: { 'ngsw-bypass': 'true' } });
  }

  /**
   * Anexa o token da sessão certa.
   *
   * Lido na hora do envio, e não guardado: depois de uma renovação, a
   * requisição repetida precisa do token NOVO. Reaproveitar o clone anterior
   * mandaria o token vencido de novo e o `401` voltaria em laço.
   */
  private comToken(req: HttpRequest<any>, sessao: Sessao): HttpRequest<any> {
    const token = sessao === 'cliente'
      ? this.clientAuthService.getToken()
      : this.authService.getToken();

    return token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  }

  /**
   * Derruba a sessão certa e leva para o login dela.
   *
   * Só a sessão que expirou: o funcionário perder o acesso ao ERP não é motivo
   * para desconectar o cliente que estava no portal no mesmo navegador.
   */
  private encerrarSessao(sessao: Sessao): void {
    if (this.redirecionando) return;
    this.redirecionando = true;

    if (sessao === 'cliente') {
      this.clientAuthService.logout();
    } else {
      this.authService.logout();
    }

    this.router
      .navigate([sessao === 'cliente' ? '/cliente/login' : '/login'],
        { queryParams: { [PARAM_SESSAO_EXPIRADA]: 1 } })
      .finally(() => (this.redirecionando = false));
  }
}
