import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  Reconciliation,
  ReconciliationChoice,
  ReconciliationResult,
} from '../../../../domain/models/customer-reconciliation.model';

/**
 * A conciliação do cadastro com o Sankhya.
 *
 * **A tela manda meses, e não uma data.** Quem deriva o dia é a API — com a data
 * vindo pronta daqui, os dois lados poderiam discordar sobre o que é "12 meses".
 */
@Injectable({ providedIn: 'root' })
export class CustomerReconciliationService {

  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customer/reconciliation`;

  /** Só lê: pode ser refeita à vontade. */
  preview(months: number): Observable<Reconciliation> {
    return this.http.get<Reconciliation>(this.base, { params: { months } });
  }

  /**
   * Grava as linhas marcadas.
   *
   * Manda **código e assinatura**, e não o que fazer: quem decide entre criar,
   * atualizar e desativar é o servidor, a partir da própria releitura do ERP.
   * A assinatura é o que faz uma aba aberta há duas horas ser recusada em vez
   * de gravar dado velho.
   */
  apply(months: number, choices: ReconciliationChoice[]): Observable<ReconciliationResult> {
    return this.http.post<ReconciliationResult>(this.base, { choices }, { params: { months } });
  }
}
