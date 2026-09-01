import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { ClientAuthService } from './client/client-auth.service';
import { LoginResponseDTO } from '../../domain/models/auth.model';
import { environment } from '../../../environments/environment';

/** Qual das duas sessões do navegador está em jogo. */
export type Sessao = 'erp' | 'cliente';

/**
 * A renovação da sessão, num lugar só.
 *
 * <b>Existe separada porque tem DOIS chamadores, e eles não podem correr.</b>
 * O interceptor renova quando uma requisição volta `401`; o guard renova quando
 * alguém navega com o token já vencido. Se cada um tivesse a sua, os dois
 * disparariam ao mesmo tempo no caso mais comum de todos — clicar num item de
 * menu depois de duas horas parado, que faz o guard rodar e as requisições da
 * tela nova saírem logo atrás.
 *
 * E aí a rotação viraria contra o usuário: a primeira renovação queima o
 * refresh que a segunda está mandando, a API lê isso como REUSO e derruba todas
 * as sessões da pessoa. Uma chamada compartilhada é o que impede a proteção do
 * servidor de disparar contra quem ela deveria proteger.
 */
@Injectable({ providedIn: 'root' })
export class SessionRefreshService {

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly clientAuth = inject(ClientAuthService);

  /** A renovação em andamento de cada sessão — as duas coexistem no navegador. */
  private emAndamento: Record<Sessao, Observable<string> | null> = { erp: null, cliente: null };

  /** Há o que renovar? Sessão antiga, ou já revogada, não tem. */
  temRefreshToken(sessao: Sessao): boolean {
    return !!this.refreshToken(sessao);
  }

  /**
   * Renova, ou entrega o resultado da renovação que já está acontecendo.
   *
   * `shareReplay(1)` faz quem chegar durante a chamada aguardar a MESMA, e quem
   * chegar depois receber o resultado guardado sem ir à rede.
   *
   * O campo volta a `null` no fim para a próxima expiração poder renovar de
   * novo; sem isso, a sessão renovaria uma vez só e nunca mais.
   */
  renovar(sessao: Sessao): Observable<string> {
    const jaEmAndamento = this.emAndamento[sessao];
    if (jaEmAndamento) return jaEmAndamento;

    const refreshToken = this.refreshToken(sessao);
    if (!refreshToken) return throwError(() => new Error('sem refresh token'));

    const chamada = this.http
      .post<LoginResponseDTO>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map(res => {
          this.guardar(sessao, res);
          this.emAndamento[sessao] = null;
          return res.token;
        }),
        catchError(erro => {
          this.emAndamento[sessao] = null;
          return throwError(() => erro);
        }),
        shareReplay(1),
      );

    this.emAndamento[sessao] = chamada;
    return chamada;
  }

  /**
   * Renova se houver o que renovar, e nunca estoura.
   *
   * É o que o guard usa: ele decide entre deixar entrar e mandar para o login,
   * e para isso precisa de uma resposta e não de um erro.
   */
  tentarRenovar(sessao: Sessao): Observable<boolean> {
    if (!this.temRefreshToken(sessao)) return of(false);

    return this.renovar(sessao).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  private refreshToken(sessao: Sessao): string | null {
    return sessao === 'cliente'
      ? this.clientAuth.getRefreshToken()
      : this.auth.getRefreshToken();
  }

  private guardar(sessao: Sessao, res: LoginResponseDTO): void {
    if (sessao === 'cliente') {
      this.clientAuth.guardarSessao(res);
    } else {
      this.auth.guardarSessao(res);
    }
  }
}
