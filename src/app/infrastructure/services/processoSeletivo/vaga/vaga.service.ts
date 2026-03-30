import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateVagaDTO, ResponseVagaDTO, UpdateVagaDTO } from '../../../../domain/models/vaga.model';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VagaService {
  private base = `${environment.apiUrl}/vaga`;

  constructor(private http: HttpClient) {}

  getVagasPublicadas(): Observable<ResponseVagaDTO[]> {
    return this.http.get<ResponseVagaDTO[]>(`${this.base}/publicadas`);
  }

  getVagasArquivadas(): Observable<ResponseVagaDTO[]> {
    return this.http.get<ResponseVagaDTO[]>(`${this.base}/arquivadas`);
  }

  getVagasEmRascunho(): Observable<ResponseVagaDTO[]> {
    return this.http.get<ResponseVagaDTO[]>(`${this.base}/rascunhos`);
  }

  getVagasEncerradas(): Observable<ResponseVagaDTO[]> {
    return this.http.get<ResponseVagaDTO[]>(`${this.base}/encerradas`);
  }

  createVaga(vaga: CreateVagaDTO): Observable<string> {
    return this.http.post(`${this.base}`, vaga, { responseType: 'text'});
  }

  updateVaga(vaga: UpdateVagaDTO): Observable<string> {
    return this.http.put(`${this.base}`, vaga, { responseType: 'text' });
  }

  publicarVaga(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/publicar`, null, { responseType: 'text'});
  }

  arquivarVaga(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/arquivar`, null, { responseType: 'text'});
  }

  rascunhoVaga(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/rascunho`, null, { responseType: 'text'});
  }

  encerrarVaga(id: string): Observable<string> {
    return this.http.put(`${this.base}/${id}/encerrar`, null, { responseType: 'text'});
  }
}
