import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DeliverEquipmentPayload,
  EquipmentAssignment,
  ReturnEquipmentPayload,
} from '../../../domain/models/hr/equipment-assignment.model';

@Injectable({
  providedIn: 'root'
})
export class EquipmentAssignmentService {

  constructor(private http: HttpClient) {}

  deliver(payload: DeliverEquipmentPayload): Observable<EquipmentAssignment> {
    return this.http.post<EquipmentAssignment>(`${environment.apiUrl}/hr/equipment-assignments`, payload);
  }

  returnEquipment(id: string, payload: ReturnEquipmentPayload): Observable<EquipmentAssignment> {
    return this.http.post<EquipmentAssignment>(`${environment.apiUrl}/hr/equipment-assignments/${id}/return`, payload);
  }

  getByEmployee(employeeId: string): Observable<EquipmentAssignment[]> {
    return this.http.get<EquipmentAssignment[]>(`${environment.apiUrl}/hr/equipment-assignments/employee/${employeeId}`);
  }

  /** Apenas os equipamentos ainda não devolvidos, de todos os funcionários. */
  listCurrentlyWithEmployees(): Observable<EquipmentAssignment[]> {
    return this.http.get<EquipmentAssignment[]>(`${environment.apiUrl}/hr/equipment-assignments`);
  }
}
