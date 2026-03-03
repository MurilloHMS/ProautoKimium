import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import {
  ForgotPasswordDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  LoginResponseDTO,
} from '../../domain/models/auth.model';
import {
  RegisterDTO,
  UserResponseDTO,
  User,
} from '../../domain/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {}

  login(login: string, password: string): Observable<LoginResponseDTO> {
    this.logout();
    return this.http.post<LoginResponseDTO>(
      `${environment.apiUrl}/auth/login`,
      { login, password }
    ).pipe(
      tap(res => localStorage.setItem('token', res.token))
    );
  }

  logout(): void {
    localStorage.removeItem('token');
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

  private decodeToken(): any {
    const token = this.getToken();
    if (!token) return null;
    try { return JSON.parse(atob(token.split('.')[1])); }
    catch { return null; }
  }
}
