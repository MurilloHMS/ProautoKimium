import { Injectable, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Machine } from '../../domain/models/prostock/machine.model';
import { MachineService } from '../services/prostock/machine.service';
import { ReferenceStore } from './reference-store';

/**
 * Catálogo de máquinas.
 *
 * Duas telas leem a mesma lista: Programação (que escolhe a máquina do registro)
 * e o Hub. Só leitura — cadastrar máquina agora é cadastrar produto marcando
 * "é máquina", em Estoque › Produtos.
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
}
