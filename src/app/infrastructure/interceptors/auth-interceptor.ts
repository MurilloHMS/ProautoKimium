import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { EMPTY, Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ClientAuthService } from '../services/client/client-auth.service';

/** O que a tela de login mostra quando a sessão caiu sozinha. */
export const PARAM_SESSAO_EXPIRADA = 'expirou';

@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {

  /**
   * Trava para o redirecionamento acontecer uma vez só.
   *
   * **É o remédio para o defeito relatado.** O token dura duas horas, e uma tela
   * que carrega cinco requisições ao abrir recebe cinco `401` no mesmo instante.
   * Sem esta trava, seriam cinco `logout`, cinco navegações e cinco mensagens —
   * que é exatamente o que a pessoa via.
   *
   * Volta a `false` na navegação, e não por tempo: enquanto a ida para o login
   * não termina, todo `401` que chegar é o mesmo acontecimento.
   */
  private redirecionando = false;

  constructor(
    private authService: AuthService,
    private clientAuthService: ClientAuthService,
    private router: Router,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    /**
     * Rotas que não têm sessão para expirar.
     *
     * O login precisa estar aqui pelos DOIS motivos: não tem token para mandar,
     * e o `401` dele significa "senha errada" e não "sessão caiu". Tratado como
     * os outros, digitar a senha errada deslogaria a pessoa e recarregaria a
     * tela de login sem dizer o que houve.
     */
    const rotasPublicas = [
      '/auth/login',
      '/auth/first-access',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/client/auth/login',
    ];

    if (rotasPublicas.some(url => req.url.includes(url))) {
      return next.handle(req);
    }

    // Duas sessões podem coexistir no mesmo navegador: o funcionário no ERP e
    // o cliente no portal. A URL decide qual token vai — mandar o do ERP para
    // `/api/client` daria 403, e mandar o do cliente para o resto vazaria a
    // sessão do portal em telas que não são dele.
    const doCliente = req.url.includes('/client/');
    const token = doCliente ? this.clientAuthService.getToken() : this.authService.getToken();

    const enviada = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(enviada).pipe(
      catchError((erro: HttpErrorResponse) => {
        if (erro.status !== 401) return throwError(() => erro);

        this.encerrarSessao(doCliente);

        /**
         * Engolido, e não repassado.
         *
         * Sessão expirada não é erro de tela: é acontecimento do aplicativo, e
         * a tela não tem nada de útil a dizer sobre ele. Repassando, cada uma
         * das dezoito telas que hoje traduz `401` para "Faça login novamente"
         * mostraria a própria mensagem — a mesma pilha de avisos de antes,
         * agora acompanhada de um redirecionamento.
         *
         * Quem explica é a tela de login, para onde a pessoa acabou de ir.
         */
        return EMPTY;
      }),
    );
  }

  /**
   * Derruba a sessão certa e leva para o login dela.
   *
   * Só a sessão que expirou: o funcionário perder o acesso ao ERP não é motivo
   * para desconectar o cliente que estava no portal no mesmo navegador.
   */
  private encerrarSessao(doCliente: boolean): void {
    if (this.redirecionando) return;
    this.redirecionando = true;

    const login = doCliente ? '/cliente/login' : '/login';

    if (doCliente) {
      this.clientAuthService.logout();
    } else {
      this.authService.logout();
    }

    this.router
      .navigate([login], { queryParams: { [PARAM_SESSAO_EXPIRADA]: 1 } })
      .finally(() => (this.redirecionando = false));
  }
}
