import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface CreateCandidaturaDTO {
  vagaID: string;       // UUID da vaga
  nome: string;
  email: string;
  telefone: string;
  urlLinkedin: string;
  pathCurriculo: string;
}

@Injectable({ providedIn: 'root' })
export class CandidaturaService {
  private base = `${environment.apiUrl}/candidatura`;

  constructor(private http: HttpClient) {}

  criar(dto: CreateCandidaturaDTO): Observable<string> {
    return this.http.post(this.base, dto, { responseType: 'text' });
  }
}