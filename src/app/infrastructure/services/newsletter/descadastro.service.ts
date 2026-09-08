import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * Descadastro da newsletter.
 *
 * **Endpoint público, sem login:** quem clica no link não é usuário do sistema
 * — é um cliente que recebeu um e-mail.
 *
 * **O token é aleatório, e não o código do cliente.** Com `?cliente=8781`
 * qualquer um descadastra qualquer um iterando números, e de quebra descobre a
 * base de clientes. E-mail é encaminhado, vaza em lista e aparece em log de
 * proxy — o token precisa não dizer nada sobre quem é.
 */
@Injectable({ providedIn: 'root' })
export class DescadastroService {

  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/newsletter/descadastro`;

  /**
   * Só sai daqui quando a pessoa clica.
   *
   * A página pergunta antes porque **pré-carregador de e-mail visita links
   * sozinho**: descadastrar no `GET` tiraria da lista gente que nunca clicou, e
   * ninguém descobre isso — a pessoa só para de receber.
   */
  descadastrar(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(token)}`, {});
  }
}
