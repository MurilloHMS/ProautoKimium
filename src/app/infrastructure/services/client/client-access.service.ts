import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * Primeiro acesso e recuperação de senha do portal.
 *
 * Os endpoints são os mesmos do sistema interno — a API sabe pelo token do
 * convite se quem está do outro lado é funcionário ou cliente, e cria o
 * usuário com o vínculo certo. O que o portal tem de próprio são as telas.
 *
 * Nenhuma chamada daqui leva token de sessão: são justamente as rotas de quem
 * ainda não tem uma.
 */
@Injectable({ providedIn: 'root' })
export class ClientAccessService {

  private readonly http = inject(HttpClient);

  /** O convite vale uma vez e expira; a tela confere antes de pedir a senha. */
  inviteIsValid(token: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/auth/first-access/${token}/is-valid`, {}, { responseType: 'text' });
  }

  /**
   * O e-mail vai no corpo porque o DTO é compartilhado com o funcionário, mas
   * no caminho do cliente a API ignora e usa o endereço gravado no convite —
   * é o que impede o convite de trocar de dono entre o envio e o clique.
   */
  signIn(token: string, password: string, email: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/auth/first-access/${token}/sign-in`, { password, email }, { responseType: 'text' });
  }

  /** Aceita e-mail, CNPJ, CPF ou login. A resposta é a mesma exista ou não a conta. */
  forgotPassword(login: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/auth/forgot-password`, { login }, { responseType: 'text' });
  }

  resetPassword(token: string, newPassword: string): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/auth/reset-password`, { token, newPassword }, { responseType: 'text' });
  }
}
