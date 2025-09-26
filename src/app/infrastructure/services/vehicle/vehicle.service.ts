import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Vehicle } from '../../../domain/models/vehicle.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  
  constructor(private http: HttpClient){}

  getVehicles(){
    return this.http.get<Vehicle[]>(`${environment.apiUrl}/vehicle`);
  }

  addVehicle(vehicle : Vehicle){
    return this.http.post<Vehicle>(`${environment.apiUrl}/vehicle`, vehicle);
  }

  updateVehicle(vehicle: Vehicle){
    return this.http.put<Vehicle>(`${environment.apiUrl}/vehicle`, vehicle);
  }
}
