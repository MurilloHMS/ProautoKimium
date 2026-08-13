import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ClientMe, ClientNewsletter } from '../../../domain/models/client.model';

/** Dados do portal do cliente. O escopo por unidade é decidido no servidor. */
@Injectable({ providedIn: 'root' })
export class ClientService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/client`;

  me(): Observable<ClientMe> {
    return this.http.get<ClientMe>(`${this.url}/me`);
  }

  /**
   * Informativos das unidades pedidas no período.
   *
   * Mandar códigos aqui é um pedido, não uma permissão: a API cruza com o que
   * é do cliente e ignora o resto. Sem unidade, devolve todas as que ele vê.
   */
  newsletter(from: string, to: string, units?: string[]): Observable<ClientNewsletter[]> {
    let params: Record<string, string | string[]> = { from, to };
    if (units?.length) params = { ...params, units };

    return this.http.get<ClientNewsletter[]>(`${this.url}/newsletter`, { params });
  }
}
