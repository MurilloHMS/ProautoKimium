import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { serviceLocation } from '../../../../domain/models/serviceLocation.model';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ServiceLocationsService {
  
  constructor(private http: HttpClient){}

  getServiceLocations(){
    return this.http.get<serviceLocation[]>(`${environment.apiUrl}/service-locations`);
  }

  addServiceLocation(serviceLocation: serviceLocation){
    return this.http.post<serviceLocation>(`${environment.apiUrl}/service-locations`, serviceLocation);
  }

  updateServiceLocation(serviceLocation: serviceLocation){
    return this.http.put<serviceLocation>(`${environment.apiUrl}/service-locations`, serviceLocation);
  }

  deleteServiceLocation(serviceLocation: serviceLocation){
    return this.http.delete(`${environment.apiUrl}/service-locations/${serviceLocation.codParceiro}`,);
  }
  
}
