import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreatePositionRequest, Position } from '../../../domain/models/hr/career.model';

@Injectable({
  providedIn: 'root'
})
export class PositionService {

  constructor(private http: HttpClient) {}

  getAll(): Observable<Position[]> {
    return this.http.get<Position[]>(`${environment.apiUrl}/hr/positions`);
  }

  create(request: CreatePositionRequest): Observable<Position> {
    return this.http.post<Position>(`${environment.apiUrl}/hr/positions`, request);
  }
}
