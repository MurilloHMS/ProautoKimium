import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Machine,
  MachineDivergence,
  ReconcileRequest,
} from '../../../domain/models/prostock/machine.model';
import { environment } from '../../../../environments/environment';

/**
 * Catálogo de máquinas (`GET api/machine`) — só leitura.
 *
 * Máquina deixou de ter cadastro próprio: é um produto marcado com `isMachine`,
 * criado e alterado em `api/inventory` como qualquer outro. Este endpoint
 * sobreviveu como projeção sobre `products` porque a Programação e o Hub já o
 * consomem e não ganhariam nada mudando de endereço.
 *
 * A movimentação também saiu daqui: o estoque da máquina é lançado pela mesma
 * tela dos demais produtos.
 */
@Injectable({ providedIn: 'root' })
export class MachineService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/machine`;

  getAll(): Observable<Machine[]> {
    return this.http.get<Machine[]>(this.url);
  }

  /**
   * Lança o movimento **e** ajusta a programação, numa chamada só.
   *
   * Uma chamada, não duas, porque as duas escritas estão na mesma transação do
   * servidor. Se a tela fizesse dois POSTs, a segunda podendo falhar sozinha,
   * ficaria meia conciliação — e ninguém saberia qual metade valeu.
   */
  /**
   * As duas contagens de cada máquina — inclusive as que batem.
   *
   * Vêm todas de propósito: ver que treze máquinas fecham é metade da
   * informação, e sem isso uma lista vazia seria indistinguível de tela
   * quebrada.
   */
  divergences(): Observable<MachineDivergence[]> {
    return this.http.get<MachineDivergence[]>(`${this.url}/divergences`);
  }

  reconcile(request: ReconcileRequest): Observable<string> {
    return this.http.post(`${this.url}/reconcile`, request, { responseType: 'text' });
  }
}
