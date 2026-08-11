import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Machine, MachineMovement } from '../../../domain/models/prostock/machine.model';
import { environment } from '../../../../environments/environment';

/**
 * Catálogo de máquinas e suas movimentações (`api/machine`).
 *
 * A API responde texto nas escritas ("Máquina Cadastrada com sucesso!"), não a
 * entidade salva — por isso o store recarrega em vez de fazer `upsert`.
 */
@Injectable({ providedIn: 'root' })
export class MachineService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/machine`;

  getAll(): Observable<Machine[]> {
    return this.http.get<Machine[]>(this.url);
  }

  create(machine: Omit<Machine, 'id'>): Observable<string> {
    return this.http.post(this.url, machine, { responseType: 'text' });
  }

  update(machine: Machine): Observable<string> {
    return this.http.put(this.url, machine, { responseType: 'text' });
  }

  delete(id: string): Observable<string> {
    return this.http.delete(`${this.url}/${id}`, { responseType: 'text' });
  }

  // ─── Movimentações da máquina ────────────────────────────────────────────

  getMovements(machineId: string): Observable<MachineMovement[]> {
    return this.http.get<MachineMovement[]>(`${this.url}/movements/${machineId}`);
  }

  createMovement(machineId: string, movement: Omit<MachineMovement, 'id'>): Observable<string> {
    return this.http.post(`${this.url}/movements/${machineId}`, movement, { responseType: 'text' });
  }

  /** O id do path aqui é o do MOVIMENTO, não o da máquina — a API mistura os dois. */
  updateMovement(movementId: string, movement: MachineMovement): Observable<string> {
    return this.http.put(`${this.url}/movements/${movementId}`, movement, { responseType: 'text' });
  }

  deleteMovement(movementId: string): Observable<string> {
    return this.http.delete(`${this.url}/movements/${movementId}`, { responseType: 'text' });
  }
}
