import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreatePositionLevelRequest, PositionLevel } from '../../../domain/models/hr/career.model';

@Injectable({
  providedIn: 'root'
})
export class PositionLevelService {

  constructor(private http: HttpClient) {}

  getByPosition(positionId: string): Observable<PositionLevel[]> {
    return this.http.get<PositionLevel[]>(`${environment.apiUrl}/hr/position-levels`, {
      params: { positionId }
    });
  }

  create(request: CreatePositionLevelRequest): Observable<PositionLevel> {
    return this.http.post<PositionLevel>(`${environment.apiUrl}/hr/position-levels`, request);
  }
}
