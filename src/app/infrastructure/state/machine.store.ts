import { Injectable, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Machine } from '../../domain/models/prostock/machine.model';
import { MachineService } from '../services/prostock/machine.service';
import { ReferenceStore } from './reference-store';

/**
 * Catálogo de máquinas.
 *
 * Três telas leem a mesma lista: Máquinas, Programação (que escolhe a máquina do
 * registro) e o Hub. Cadastrar uma máquina precisa aparecer no seletor da
 * programação na hora, sem recarregar a página.
 */
@Injectable({ providedIn: 'root' })
export class MachineStore extends ReferenceStore<Machine> {

  private readonly service = inject(MachineService);

  protected fetch(): Observable<Machine[]> { return this.service.getAll(); }
  protected idOf(item: Machine): string { return item.id; }

  readonly options = computed(() =>
    this.items().map(machine => ({ label: machine.name, value: machine.id })));

  /** Só as ativas: programar uma máquina desativada não faz sentido. */
  readonly activeOptions = computed(() =>
    this.items().filter(machine => machine.active).map(machine => ({ label: machine.name, value: machine.id })));

  /** Traduz o id gravado no registro. Cai no próprio id se a máquina sumiu. */
  nameOf(machineId: string): string {
    return this.items().find(machine => machine.id === machineId)?.name ?? machineId;
  }

  /** A API responde texto ("Máquina Cadastrada com sucesso!"), não a entidade. */
  create(machine: Omit<Machine, 'id'>): Observable<string> {
    return this.refreshAfter(this.service.create(machine));
  }

  update(machine: Machine): Observable<string> {
    return this.refreshAfter(this.service.update(machine));
  }

  /** Apaga no servidor. O `remove` da base só tira da lista local. */
  deleteById(id: string): Observable<string> {
    return this.refreshAfter(this.service.delete(id));
  }

  private refreshAfter(source: Observable<string>): Observable<string> {
    return source.pipe(tap(() => this.refresh()));
  }
}
