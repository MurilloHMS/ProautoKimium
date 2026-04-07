import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {ResponseCandidaturaDTO} from "../../../../domain/models/candidatura.model";

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

  getByVaga(vagaId: string): Observable<ResponseCandidaturaDTO[]> {
    return this.http.get<ResponseCandidaturaDTO[]>(`${this.base}/${vagaId}`);
  }

  avancar(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/avancar`, null, { responseType: 'text' });
  }

  aprovar(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/aprovar`, null, { responseType: 'text' });
  }

  reprovar(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/reprovar`, null, { responseType: 'text' });
  }

  encerrar(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/encerrar`, null, { responseType: 'text' });
  }
}
