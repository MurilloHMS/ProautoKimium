import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { EMPTY, Observable, catchError, map, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ClientAuthService } from '../services/client/client-auth.service';
import { LoginResponseDTO } from '../../domain/models/auth.model';
import { environment } from '../../../environments/environment';

/** O que a tela de login mostra quando a sessão caiu sozinha. */
export const PARAM_SESSAO_EXPIRADA = 'expirou';

/** Qual das duas sessões do navegador está em jogo. */
type Sessao = 'erp' | 'cliente';

@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {

  /**
   * A renovação em andamento de cada sessão.
   *
   * **É o que impede uma tempestade de renovações.** O token dura duas horas, e
   * uma tela que carrega cinco requisições recebe cinco `401` no mesmo instante.
   * Sem isto, as cinco chamariam `/auth/refresh` — e como a rotação queima o
   * token a cada uso, a primeira renovação invalidaria o token que as outras
   * quatro estão mandando. As quatro seriam lidas pela API como REUSO, que
   * derruba todas as sessões da pessoa.
   *
   * Ou seja: sem a fila, o mecanismo de segurança do servidor dispararia contra
   * o próprio usuário legítimo, toda vez que o token vencesse.
   *
   * Uma por sessão, porque as duas coexistem no mesmo navegador.
   */
  private renovando: Record<Sessao, Observable<string> | null> = { erp: null, cliente: null };

  /** Trava do redirecionamento, para vários `401` produzirem uma ida só ao login. */
  private redirecionando = false;

  constructor(
    private authService: AuthService,
    private clientAuthService: ClientAuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
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
    return this.renovacao(sessao).pipe(
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
   * A renovação da sessão, compartilhada por quem chegar enquanto ela acontece.
   *
   * `shareReplay(1)` faz a segunda, terceira e quinta requisição aguardarem a
   * MESMA chamada em vez de dispararem a sua — e quem chegar depois de ela
   * terminar recebe o resultado guardado sem ir à rede.
   *
   * O campo volta a `null` no fim para a próxima expiração poder renovar de
   * novo; sem isso, a sessão renovaria uma vez só e nunca mais.
   */
  private renovacao(sessao: Sessao): Observable<string> {
    const emAndamento = this.renovando[sessao];
    if (emAndamento) return emAndamento;

    const refreshToken = sessao === 'cliente'
      ? this.clientAuthService.getRefreshToken()
      : this.authService.getRefreshToken();

    if (!refreshToken) return throwError(() => new Error('sem refresh token'));

    const chamada = this.http
      .post<LoginResponseDTO>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map(res => {
          if (sessao === 'cliente') {
            this.clientAuthService.guardarSessao(res);
          } else {
            this.authService.guardarSessao(res);
          }
          this.renovando[sessao] = null;
          return res.token;
        }),
        catchError(erro => {
          this.renovando[sessao] = null;
          return throwError(() => erro);
        }),
        shareReplay(1),
      );

    this.renovando[sessao] = chamada;
    return chamada;
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
