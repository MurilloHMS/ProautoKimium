import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { MachineAlertConfig } from '../../../domain/models/prostock/machine-alert.model';
import { environment } from '../../../../environments/environment';

/** Configuração dos alertas de previsão de saída (uma por empresa). */
@Injectable({ providedIn: 'root' })
export class MachineAlertService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/machine/alert-config`;

  get(): Observable<MachineAlertConfig> {
    return this.http.get<MachineAlertConfig>(this.url);
  }

  save(config: MachineAlertConfig): Observable<MachineAlertConfig> {
    return this.http.put<MachineAlertConfig>(this.url, config);
  }

  /** Dispara o alerta agora, para conferir o texto e a lista sem esperar o job. */
  sendTest(): Observable<unknown> {
    return this.http.post(`${this.url}/test`, {}, { responseType: 'text' });
  }
}
