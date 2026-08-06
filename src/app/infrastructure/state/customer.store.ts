import { Injectable, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Customer } from '../../domain/models/customer.model';
import { CustomerService } from '../services/partners/customer/customer.service';
import { ReferenceStore } from './reference-store';

/**
 * Clientes.
 *
 * Hoje só a tela de clientes lê a lista inteira, mas ela segue o mesmo
 * contrato dos outros cadastros: a tela não guarda cópia, e quem precisar de
 * um combo de cliente amanhã lê daqui em vez de buscar de novo.
 */
@Injectable({ providedIn: 'root' })
export class CustomerStore extends ReferenceStore<Customer> {

  private readonly service = inject(CustomerService);

  protected fetch(): Observable<Customer[]> { return this.service.getCustomers(); }

  /** O cliente não tem id próprio: a chave é o código de parceiro. */
  protected idOf(item: Customer): string { return item.codParceiro; }

  readonly options = computed(() =>
    this.items().map(customer => ({ label: customer.nome, value: customer.codParceiro })));

  /** Aqui a API devolve o cliente salvo, então dá para fazer `upsert` direto. */
  create(customer: Customer): Observable<Customer> {
    return this.withUpsert(this.service.addCustomer(customer));
  }

  update(customer: Customer): Observable<Customer> {
    return this.withUpsert(this.service.updateCustomer(customer));
  }

  /** A planilha mexe em muitas linhas de uma vez; só recarregando dá para saber quais. */
  importByExcel(file: File): Observable<unknown> {
    return this.service.importCustomersByExcel(file).pipe(tap(() => this.refresh()));
  }
}
