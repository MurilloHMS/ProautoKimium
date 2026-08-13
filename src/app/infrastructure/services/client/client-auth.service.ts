import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { LoginResponseDTO } from '../../../domain/models/auth.model';

/** Chave própria: cliente e funcionário podem estar logados no mesmo navegador. */
const CLIENT_TOKEN_KEY = 'client_token';

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

  /** Aceita e-mail ou CNPJ, com ou sem pontuação — a API resolve os dois. */
  login(login: string, password: string): Observable<LoginResponseDTO> {
    this.logout();

    return this.http.post<LoginResponseDTO>(`${environment.apiUrl}/auth/login`, { login, password })
      .pipe(tap(response => localStorage.setItem(CLIENT_TOKEN_KEY, response.token)));
  }

  logout(): void {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(CLIENT_TOKEN_KEY);
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
