import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PermissionStore } from '../state/permission.store';
import { environment } from '../../../environments/environment';

import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  LoginResponseDTO,
  NewAccessDTO,
  NewAccessPasswordDTO
} from '../../domain/models/auth.model';
import {
  RegisterDTO,
  UserResponseDTO,
  User,
} from '../../domain/models/user.model';

/** Onde o refresh token do ERP fica. */
const REFRESH_KEY = 'refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly permissions = inject(PermissionStore);

  constructor(private http: HttpClient) {}

  login(login: string, password: string): Observable<LoginResponseDTO> {
    this.logout();
    return this.http.post<LoginResponseDTO>(
      `${environment.apiUrl}/auth/login`,
      { login, password }
    ).pipe(
      tap(res => this.guardarSessao(res))
    );
  }

  /**
   * Guarda os dois tokens de uma vez.
   *
   * Usado pelo login e pela renovação — os dois recebem a mesma resposta, e ter
   * um lugar só evita que a renovação esqueça de gravar o refresh novo, que é o
   * jeito silencioso de quebrar a rotação.
   */
  guardarSessao(res: LoginResponseDTO): void {
    localStorage.setItem('token', res.token);

    // API antiga não manda o refresh. Gravar `undefined` viraria a string
    // "undefined" e a renovação tentaria trocá-la por um token de verdade.
    if (res.refreshToken) {
      localStorage.setItem(REFRESH_KEY, res.refreshToken);
    }
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  /**
   * Sair de verdade: avisa o servidor e só então limpa o navegador.
   *
   * O `logout()` sozinho apaga o que está nesta máquina, e o refresh token
   * continua valendo sete dias do outro lado. Isso não é encerrar sessão — é
   * esconder a chave.
   *
   * A limpeza local acontece de qualquer jeito, mesmo se a chamada falhar: quem
   * apertou "Sair" tem que sair, e ficar preso numa tela por causa de rede é
   * pior do que um refresh token sobrevivendo até vencer sozinho.
   *
   * Quem garante isso é o `catchError`, que transforma a falha numa conclusão
   * normal — o `finalize` depois dele cobre um caso a mais: quem se desinscreve
   * antes da resposta, como uma tela que navega no meio do caminho.
   */
  logoutRemoto(): Observable<void> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.logout();
      return of(void 0);
    }

    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, { refreshToken }).pipe(
      catchError(() => of(void 0)),
      finalize(() => this.logout()),
    );
  }

  /**
   * Esquece o token **e as permissões**.
   *
   * Sem o `clear`, o próximo login herdaria o mapa do anterior: quem entrasse
   * depois do admin veria o menu do admin até a requisição nova responder. É
   * curto, e é exatamente o tipo de janela em que alguém clica.
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem(REFRESH_KEY);
    this.permissions.clear();
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    const expDate = this.getExpirationDate();
    if (!expDate) { this.logout(); return false; }
    return expDate > new Date();
  }

  forgotPassword(login: string): Observable<string> {
    const body: ForgotPasswordDTO = { login };
    return this.http.post(
      `${environment.apiUrl}/auth/forgot-password`,
      body,
      { responseType: 'text' }
    );
  }

  resetPassword(token: string, newPassword: string): Observable<string> {
    const body: ResetPasswordDTO = { token, newPassword };
    return this.http.post(
      `${environment.apiUrl}/auth/reset-password`,
      body,
      { responseType: 'text' }
    );
  }

  changePassword(login: string, newPassword: string): Observable<string> {
    const body: ChangePasswordDTO = { login, newPassword };
    return this.http.post(
      `${environment.apiUrl}/auth/change-password`,
      body,
      { responseType: 'text' }
    );
  }

  registerUser(user: RegisterDTO): Observable<string> {
    return this.http.post(
      `${environment.apiUrl}/auth/register`,
      user,
      { responseType: 'text' }
    );
  }

  getUsers(): Observable<UserResponseDTO[]> {
    return this.http.get<UserResponseDTO[]>(`${environment.apiUrl}/auth/users`);
  }


  getStockControlToken(): Observable<string> {
    return this.http.post<LoginResponseDTO>(
      `${environment.apiUrl}/auth/app-token`,
      {}
    ).pipe(
      map(res => res.token)
    );
  }


  getUserRoles(): string[] {
    return this.decodeToken()?.roles ?? [];
  }

  getUsername(): string | null {
    const payload = this.decodeToken();
    return payload?.sub ?? payload?.name ?? payload?.preferred_username ?? null;
  }

  getExpirationDate(): Date | null {
    const payload = this.decodeToken();
    if (!payload?.exp) return null;
    return new Date(payload.exp * 1000);
  }

  hasRole(roles: string | string[]): boolean {
    const userRoles = this.getUserRoles();
    return typeof roles === 'string'
      ? userRoles.includes(roles)
      : roles.some(r => userRoles.includes(r));
  }

  getCurrentUser(): User | null {
    const payload = this.decodeToken();
    if (!payload) return null;
    return {
      id:    payload.id    ?? payload.sub ?? '',
      login: payload.sub   ?? payload.name ?? '',
      roles: payload.roles ?? [],
    };
  }

  updateUserRoles(login: string, roles: string[]): Observable<string> {
    return this.http.put(
      `${environment.apiUrl}/auth/users/${login}/roles`,
      { roles },
      { responseType: 'text' }
    );
  }

  blockUser(login: string): Observable<string> {
    return this.http.put(
      `${environment.apiUrl}/auth/users/${login}/block`,
      null,
      { responseType: 'text' }
    );
  }

  unblockUser(login: string): Observable<string> {
    return this.http.put(
      `${environment.apiUrl}/auth/users/${login}/unblock`,
      null,
      { responseType: 'text' }
    );
  }

  resetPasswordByAdmin(login: string): Observable<string> {
    return this.http.post(
      `${environment.apiUrl}/auth/users/${login}/reset-password`,
      null,
      { responseType: 'text' }
    );
  }

  /** Vincula um usuário a um funcionário (parceiro) pelo código do parceiro. */
  linkEmployee(login: string, codParceiro: string): Observable<string> {
    return this.http.put(
      `${environment.apiUrl}/auth/users/${login}/employee`,
      { codParceiro },
      { responseType: 'text' }
    );
  }

  /** Remove o vínculo de um usuário com o funcionário. */
  unlinkEmployee(login: string): Observable<string> {
    return this.http.delete(
      `${environment.apiUrl}/auth/users/${login}/employee`,
      { responseType: 'text' }
    );
  }

  private decodeToken(): any {
    const token = this.getToken();
    if (!token) return null;
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
  }

  firstAccessGenerateToken(cpf: string, email: string): Observable<string> {
    const body: NewAccessDTO = { cpf, email };
    return this.http.post(
      `${environment.apiUrl}/auth/first-access`,
      body,
      { responseType: 'text' }
    );
  }

  firstAccessValidateToken(token: string): Observable<string> {
    return this.http.post(
      `${environment.apiUrl}/auth/first-access/${token}/is-valid`,
      null,
      { responseType: 'text' }
    );
  }

  firstAccessCreateUsername(token: string, password: string, email: string): Observable<string>{
    const body: NewAccessPasswordDTO = { password, email };
    return this.http.post(
      `${environment.apiUrl}/auth/first-access/${token}/sign-in`, body, { responseType: 'text' },
    );
  }
}
