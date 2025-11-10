import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Maintenance } from '../../../../domain/models/maintenance.model';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {

  constructor(private http: HttpClient){}

  getMaintenances(){
    return this.http.get<Maintenance[]>(`${environment.apiUrl}/vehicle/revision`);
  }

  addMaintenance(maintenance: Maintenance){
    return this.http.post<Maintenance>(`${environment.apiUrl}/vehicle/revision`, maintenance);
  }

  updateMaintenance(maintenance: Maintenance){
    return this.http.put<Maintenance>(`${environment.apiUrl}/vehicle/revision`, maintenance);
  }
}
