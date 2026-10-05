import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EmployeeDocument,
  EmployeeDocumentType,
  EmployeeDocumentTypeRequest,
  EmployeeDocumentUpdate,
} from '../../../domain/models/hr/employee-document.model';

/** O que o RH manda ao vincular um documento. */
export interface LinkEmployeeDocument {
  employeeId: string;
  typeId: string;
  title: string;
  /** `yyyy-MM-dd`; nulo = sem vencimento. */
  dueDate: string | null;
  /** O documento ativo que este substitui (para de gerar aviso). */
  replacesId: string | null;
  file: File;
}

@Injectable({ providedIn: 'root' })
export class EmployeeDocumentService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/hr/employee-documents`;
  private readonly typesUrl = `${environment.apiUrl}/hr/employee-document-types`;

  getMine(): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.url}/me`);
  }

  /**
   * A lista do RH, inteira. Os filtros da tela são aplicados no navegador: os
   * chips mostram a contagem do quadro todo, e ela não pode mudar só porque
   * outro filtro foi ligado.
   */
  search(): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(this.url);
  }

  link(request: LinkEmployeeDocument): Observable<EmployeeDocument> {
    const form = new FormData();
    form.append('employeeId', request.employeeId);
    form.append('typeId', request.typeId);
    form.append('title', request.title);
    if (request.dueDate) form.append('dueDate', request.dueDate);
    if (request.replacesId) form.append('replacesId', request.replacesId);
    form.append('file', request.file);
    return this.http.post<EmployeeDocument>(this.url, form);
  }

  update(id: string, body: EmployeeDocumentUpdate): Observable<EmployeeDocument> {
    return this.http.put<EmployeeDocument>(`${this.url}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/arquivo`, { responseType: 'blob' });
  }

  listTypes(): Observable<EmployeeDocumentType[]> {
    return this.http.get<EmployeeDocumentType[]>(this.typesUrl);
  }

  createType(body: EmployeeDocumentTypeRequest): Observable<EmployeeDocumentType> {
    return this.http.post<EmployeeDocumentType>(this.typesUrl, body);
  }

  updateType(id: string, body: EmployeeDocumentTypeRequest): Observable<EmployeeDocumentType> {
    return this.http.put<EmployeeDocumentType>(`${this.typesUrl}/${id}`, body);
  }

  /**
   * Roda os avisos de vencimento de hoje, o mesmo que o agendamento das 8h.
   * Seguro de repetir: cada aviso sai uma vez só.
   */
  runAlerts(): Observable<{ alerted: number }> {
    return this.http.post<{ alerted: number }>(`${environment.apiUrl}/hr/employee-document-alerts/run`, {});
  }

  /** Desativa: tipo com documentos não some. */
  deactivateType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.typesUrl}/${id}`);
  }

  /** Os documentos de um funcionário, para a ficha (o mesmo endpoint da lista, filtrado). */
  getByEmployee(employeeId: string): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${environment.apiUrl}/hr/employee-documents`, { params: { employeeId } });
  }
}

/** A data do calendário no formato da API, sem fuso: meia-noite local não pode virar o dia anterior. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

}
