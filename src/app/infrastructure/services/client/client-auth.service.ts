import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LoginResponseDTO } from '../../../domain/models/auth.model';

/** Chave própria: cliente e funcionário podem estar logados no mesmo navegador. */
const CLIENT_TOKEN_KEY = 'client_token';
const CLIENT_REFRESH_KEY = 'client_refresh_token';

/**
 * Sessão do cliente, separada da do funcionário.
 *
 * O portal usa o mesmo `POST /api/auth/login` do sistema interno — quem decide
 * o que a pessoa vê é o vínculo com o cliente, não um endpoint diferente. O que
 * muda é onde o token fica guardado: com uma chave só, entrar no portal
 * derrubaria a sessão do ERP na outra aba, e vice-versa.
 */
@Injectable({ providedIn: 'root' })
export class ClientAuthService {

  private readonly http = inject(HttpClient);

  /**
   * Aceita e-mail ou CNPJ, com ou sem pontuação — a API resolve os dois.
   *
   * Sem "lembrar de mim", a sessão vai para o `sessionStorage` e morre quando
   * a aba fecha. O portal é usado em computador compartilhado de recepção;
   * a caixa desmarcada precisa significar alguma coisa.
   */
  login(login: string, password: string, remember = true): Observable<LoginResponseDTO> {
    this.logout();

    return this.http.post<LoginResponseDTO>(`${environment.apiUrl}/auth/login`, { login, password })
      .pipe(tap(response => this.guardarSessao(response, remember ? localStorage : sessionStorage)));
  }

  /**
   * Guarda os dois tokens no mesmo lugar.
   *
   * A renovação não sabe se a pessoa marcou "lembrar de mim", então ela grava
   * onde o token atual já está — senão uma sessão de recepção, que deveria
   * morrer com a aba, migraria para o `localStorage` na primeira renovação e
   * passaria a sobreviver ao fechamento.
   */
  guardarSessao(res: LoginResponseDTO, store: Storage = this.storeAtual()): void {
    store.setItem(CLIENT_TOKEN_KEY, res.token);

    if (res.refreshToken) {
      store.setItem(CLIENT_REFRESH_KEY, res.refreshToken);
    }
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(CLIENT_REFRESH_KEY) ?? sessionStorage.getItem(CLIENT_REFRESH_KEY);
  }

  /** Onde a sessão de agora mora — é para lá que a renovação grava. */
  private storeAtual(): Storage {
    return localStorage.getItem(CLIENT_TOKEN_KEY) !== null ? localStorage : sessionStorage;
  }

  logout(): void {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
    sessionStorage.removeItem(CLIENT_TOKEN_KEY);
    localStorage.removeItem(CLIENT_REFRESH_KEY);
    sessionStorage.removeItem(CLIENT_REFRESH_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(CLIENT_TOKEN_KEY) ?? sessionStorage.getItem(CLIENT_TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const expiresAt = this.expirationDate();
    if (!expiresAt) {
      this.logout();
      return false;
    }
    return expiresAt > new Date();
  }

  /**
   * Lê o `exp` do JWT sem validar assinatura — serve para não mostrar uma tela
   * que a API vai recusar, e não como controle de acesso. Quem decide é o
   * servidor.
   */
  private expirationDate(): Date | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }
}
