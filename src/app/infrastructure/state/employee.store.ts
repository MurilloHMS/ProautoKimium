import { Injectable, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Employee } from '../../domain/models/employee.model';
import { EmployeeService } from '../services/partners/employee/employee.service';
import { ReferenceStore } from './reference-store';

/**
 * Funcionários — a lista mais compartilhada do sistema.
 *
 * Seis telas de RH liam a mesma lista, cada uma montando na mão o próprio mapa
 * de id → nome e a própria lista de opções. Com abas abertas ao mesmo tempo,
 * cadastrar um funcionário deixava todas elas desatualizadas até a página ser
 * recarregada. Aqui a lista é uma só, e o mapa e as opções são derivados dela.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeStore extends ReferenceStore<Employee> {

  private readonly service = inject(EmployeeService);

  protected fetch(): Observable<Employee[]> { return this.service.getEmployes(); }

  /** Antes de salvar pela primeira vez só existe o código do parceiro. */
  protected idOf(item: Employee): string { return item.id ?? item.partnerCode; }

  private readonly withId = computed(() => this.items().filter(employee => !!employee.id));

  /**
   * Todos, inclusive desligados: grade e histórico precisam mostrar o nome de
   * quem já saiu.
   */
  readonly options = computed(() => this.withId().map(toOption));

  /**
   * Só os ativos: quem escolhe um funcionário para uma solicitação nova não
   * deve enxergar quem foi desligado.
   */
  readonly activeOptions = computed(() => this.withId().filter(employee => employee.ativo).map(toOption));

  private readonly namesById = computed(
    () => new Map(this.withId().map(employee => [employee.id as string, employee.name])));

  /** Traduz a chave gravada no registro. Cai no próprio id se não achar. */
  nameOf(employeeId: string): string {
    return this.namesById().get(employeeId) ?? employeeId;
  }

  /**
   * A API responde texto, não o funcionário salvo — sem o id gerado e sem os
   * campos que ela calcula (salário, nome do cargo), não dá para fazer
   * `upsert`. Recarregar é o que mantém a lista fiel ao servidor.
   */
  create(employee: Employee): Observable<unknown> {
    return this.service.addEmploye(employee).pipe(tap(() => this.refresh()));
  }

  update(employee: Employee): Observable<unknown> {
    return this.service.updateEmploye(employee).pipe(tap(() => this.refresh()));
  }
}

function toOption(employee: Employee): { label: string; value: string } {
  return { label: employee.name, value: employee.id as string };
}
