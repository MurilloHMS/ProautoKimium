import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  ClienteDaNewsletter,
  CorrecaoDeHora,
  EmailPreenchido,
  PreviaNewsletter,
} from '../../../domain/models/newsletter/previa.model';

/**
 * A prévia da newsletter, buscada direto do ERP.
 *
 * **Mês e ano, não intervalo de datas** — a newsletter é mensal, e mandar o mês
 * faz sumirem sozinhas várias perguntas: início depois do fim não existe, mês
 * pela metade não existe, e `mes` e `data` nunca discordam porque saem da mesma
 * origem. Quem deriva o primeiro e o último dia é a API.
 */
@Injectable({ providedIn: 'root' })
export class PreviaNewsletterService {

  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/newsletter/previa`;

  /**
   * Busca no Sankhya e cria o rascunho.
   *
   * Pedir o mesmo mês duas vezes **devolve o rascunho existente** em vez de
   * criar outro — decisão dele, e é o que deixa sair da tela no meio da revisão
   * e voltar depois sem perder as correções.
   *
   * Mês já confirmado é recusado pela API, com a data e a quantidade de
   * clientes daquela confirmação no corpo do erro.
   */
  buscar(mes: number, ano: number): Observable<PreviaNewsletter> {
    return this.http.post<PreviaNewsletter>(this.base, { mes, ano });
  }

  /**
   * Corrige a hora de uma OS.
   *
   * Devolve **o cliente recalculado**, e não só um "ok": assim a tela não
   * refaz a conta por conta própria, e o número que aparece é o que a API
   * calculou. Duas contas para o mesmo valor é como elas passam a discordar.
   */
  corrigirHora(previaId: string, numeroOs: number, correcao: CorrecaoDeHora): Observable<ClienteDaNewsletter> {
    return this.http.put<ClienteDaNewsletter>(`${this.base}/${previaId}/os/${numeroOs}`, correcao);
  }

  /**
   * Grava os e-mails preenchidos à mão, vários de uma vez.
   *
   * São 31 clientes sem e-mail em junho, e um por requisição faria a tela
   * disparar 31 chamadas para um trabalho que é um só.
   */
  preencherEmails(previaId: string, emails: EmailPreenchido[]): Observable<ClienteDaNewsletter[]> {
    return this.http.put<ClienteDaNewsletter[]>(`${this.base}/${previaId}/emails`, { emails });
  }

  /** Grava na newsletter e libera para a fila de envio. */
  confirmar(previaId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${previaId}/confirmar`, {});
  }
}
