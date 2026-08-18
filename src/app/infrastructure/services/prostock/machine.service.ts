import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Machine } from '../../../domain/models/prostock/machine.model';
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
}
