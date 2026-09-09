import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { Newsletter } from '../../../domain/models/newsletter.model';
import type { ResumoDoMes } from '../../../domain/models/newsletter/resumo-do-mes.model';

@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  constructor(private http: HttpClient){}

  createNewsletterWithOneFile(file: File, isMatriz: boolean = false){
    const formData = new FormData();
    formData.append('file', file);
    formData.append('isMatriz', String(isMatriz));

    return this.http.post(`${environment.apiUrl}/newsletter/upload/one-file`, formData, {responseType: 'text'});
  }

  /**
   * A fila contada por mês.
   *
   * `pending` continua existindo e continua servindo para a lista de pendentes.
   * O que ele não responde é "a de junho já saiu?", porque só enxerga o que
   * ainda não saiu — e essa é a pergunta que a tela de envio precisa responder.
   */
  resumoPorMes(): Observable<ResumoDoMes[]> {
    return this.http.get<ResumoDoMes[]>(`${environment.apiUrl}/newsletter/resumo`);
  }

  /** As linhas de um mês, todos os status, do maior faturamento para o menor. */
  doMes(mes: number, ano: number): Observable<Newsletter[]> {
    return this.http.get<Newsletter[]>(`${environment.apiUrl}/newsletter/mes`, {
      params: { mes, ano },
    });
  }

  sendPendingNewsletters(){
    return this.http.post(`${environment.apiUrl}/newsletter/pending/send`, "", {responseType: 'text'});
  }
}
