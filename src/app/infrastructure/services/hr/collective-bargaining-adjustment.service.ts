import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApplyCollectiveBargainingAdjustmentRequest,
  CollectiveBargainingAdjustmentResult
} from '../../../domain/models/hr/career.model';

@Injectable({
  providedIn: 'root'
})
export class CollectiveBargainingAdjustmentService {

  constructor(private http: HttpClient) {}

  apply(request: ApplyCollectiveBargainingAdjustmentRequest): Observable<CollectiveBargainingAdjustmentResult> {
    return this.http.post<CollectiveBargainingAdjustmentResult>(
      `${environment.apiUrl}/hr/collective-bargaining-adjustments`,
      request
    );
  }
}
