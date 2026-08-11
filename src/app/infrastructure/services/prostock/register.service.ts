import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateMachineRegister,
  MachineRegister,
  UpdateMachineRegister,
} from '../../../domain/models/prostock/register.model';
import { environment } from '../../../../environments/environment';

/**
 * Programação de máquinas (`api/machine/register`) — o equivalente da planilha
 * que o time mantém hoje no Excel.
 */
@Injectable({ providedIn: 'root' })
export class RegisterService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/machine/register`;

  getAll(): Observable<MachineRegister[]> {
    return this.http.get<MachineRegister[]>(this.url);
  }

  getByMachine(machineId: string): Observable<MachineRegister[]> {
    return this.http.get<MachineRegister[]>(`${this.url}/${machineId}`);
  }

  create(register: CreateMachineRegister): Observable<string> {
    return this.http.post(this.url, register, { responseType: 'text' });
  }

  update(id: string, register: UpdateMachineRegister): Observable<string> {
    return this.http.put(`${this.url}/${id}`, register, { responseType: 'text' });
  }

  delete(id: string): Observable<string> {
    return this.http.delete(`${this.url}/${id}`, { responseType: 'text' });
  }
}
