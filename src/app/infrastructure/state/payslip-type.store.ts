import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreatePayslipTypeResult, PayslipType, PayslipTypeView, payslipTypeView,
} from '../../domain/models/hr/holerite.model';
import { ReferenceStore } from './reference-store';

/**
 * Os tipos de holerite, lidos da API e compartilhados: o envio, a auditoria e a
 * tela do funcionário leem a mesma lista. Um tipo criado no envio aparece na
 * auditoria aberta em outra aba sem recarregar.
 */
@Injectable({ providedIn: 'root' })
export class PayslipTypeStore extends ReferenceStore<PayslipType> {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/holerite/types`;

  protected fetch(): Observable<PayslipType[]> { return this.http.get<PayslipType[]>(this.url); }
  protected idOf(item: PayslipType): string { return item.code; }

  readonly views = computed<PayslipTypeView[]>(() => this.items().map(payslipTypeView));

  /** O nome do tipo; o próprio código quando a lista ainda não chegou ou ele saiu dela. */
  labelOf(code: string): string {
    return this.items().find(t => t.code === code)?.label ?? code;
  }

  viewOf(code: string): PayslipTypeView {
    return payslipTypeView(this.items().find(t => t.code === code) ?? { code, label: code });
  }

  /** Cria, ou recebe o existente com o mesmo nome. Os dois entram na lista. */
  create(label: string): Observable<CreatePayslipTypeResult> {
    return this.http.post<CreatePayslipTypeResult>(this.url, { label })
      .pipe(tap(r => this.upsert(r.type)));
  }
}
