import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  CreateMachineRegister,
  MachineRegister,
  UpdateMachineRegister,
} from '../../domain/models/prostock/register.model';
import { RegisterService } from '../services/prostock/register.service';
import { ReferenceStore } from './reference-store';

/**
 * Programação de máquinas.
 *
 * A grade editável e o Hub leem a mesma lista: mudar um status na programação
 * precisa mexer no KPI do Hub sem recarregar nada.
 */
@Injectable({ providedIn: 'root' })
export class MachineRegisterStore extends ReferenceStore<MachineRegister> {

  private readonly service = inject(RegisterService);

  protected fetch(): Observable<MachineRegister[]> { return this.service.getAll(); }
  protected idOf(item: MachineRegister): string { return item.id; }

  create(register: CreateMachineRegister): Observable<string> {
    return this.refreshAfter(this.service.create(register));
  }

  /**
   * A grade salva célula a célula, então isto é chamado a cada saída de campo.
   * O `refresh` mantém a lista fiel, mas quem chama deve evitar disparar o
   * salvamento quando o valor não mudou.
   */
  update(id: string, register: UpdateMachineRegister): Observable<string> {
    return this.refreshAfter(this.service.update(id, register));
  }

  /** Apaga no servidor. O `remove` da base só tira da lista local. */
  deleteById(id: string): Observable<string> {
    return this.refreshAfter(this.service.delete(id));
  }

  private refreshAfter(source: Observable<string>): Observable<string> {
    return source.pipe(tap(() => this.refresh()));
  }
}
