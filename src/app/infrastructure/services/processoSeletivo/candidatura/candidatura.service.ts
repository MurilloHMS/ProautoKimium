import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {CreateCandidaturaDTO, ResponseCandidaturaDTO} from "../../../../domain/models/candidatura.model";

@Injectable({ providedIn: 'root' })
export class CandidaturaService {
  private base = `${environment.apiUrl}/candidatura`;
  private curriculosBase = `${environment.apiUrl}/curriculos`;


  constructor(private http: HttpClient) {}

  criar(dto: CreateCandidaturaDTO, curriculo?:File): Observable<string> {
    const formData = new FormData();
    formData.append('dados', new Blob([JSON.stringify(dto)], {type: 'application/json'}));
    if(curriculo){
      formData.append('curriculo', curriculo, curriculo.name);
    }
    return this.http.post(this.base, formData, { responseType: 'text' });
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

  getCurriculoUrl(fileName: string | null | undefined): string | null {
    if (!fileName?.trim()) return null;
    return `${this.curriculosBase}/${encodeURIComponent(fileName)}`;
  }

  baixarCurriculo(fileName: string): Observable<Blob> {
    return this.http.get(
      `${this.curriculosBase}/${encodeURIComponent(fileName)}`,
      { responseType: 'blob' }
    );
  }
}
