import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { HomeSummary } from '../../../domain/models/home/home-summary.model';
import { environment } from '../../../../environments/environment';

/** O que está esperando o usuário logado, numa chamada só. */
@Injectable({ providedIn: 'root' })
export class HomeService {

  private readonly http = inject(HttpClient);

  getSummary(): Observable<HomeSummary> {
    return this.http.get<HomeSummary>(`${environment.apiUrl}/home/summary`);
  }
}
