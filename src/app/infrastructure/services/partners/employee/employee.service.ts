import { Employee } from './../../../../domain/models/employee.model';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { empty, Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {Recipient} from "../../../../domain/models/partnerRecipient.model";
import {ErpPartner} from "../../../../domain/models/erp-partner.model";

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {

  constructor(private http: HttpClient){}

  getEmployes() : Observable<Employee[]>{
    return this.http.get<Employee[]>(`${environment.apiUrl}/employee`);
  }

  /**
   * O relatório dos funcionários ativos que ainda não entraram no site.
   *
   * A resposta inteira, e não só o corpo: o nome do arquivo vem no
   * `Content-Disposition`, e é a API que sabe se saiu .xlsx ou .pdf.
   */
  downloadPendingSiteAccessReport(format: 'xlsx' | 'pdf'): Observable<HttpResponse<Blob>> {
    return this.http.get(`${environment.apiUrl}/employee/site-access/pending/report`, {
      params: { format },
      responseType: 'blob',
      observe: 'response',
    });
  }

  getEmployeeEmail() : Observable<Recipient[]>{
    return this.http.get<Recipient[]>(`${environment.apiUrl}/employee/only-email`);
  }

  /**
   * Busca um parceiro no Sankhya pelo CODPARC.
   *
   * Responde 404 quando o código não existe no ERP e 400 quando não é
   * numérico. A permissão é `rh/employees:INCLUIR` e não CONSULTAR: com
   * CONSULTAR, quem vê a lista de funcionários poderia varrer o ERP um código
   * por vez colhendo nome, CPF e e-mail.
   */
  lookupInErp(codParceiro: number): Observable<ErpPartner> {
    return this.http.get<ErpPartner>(`${environment.apiUrl}/employee/erp/${codParceiro}`);
  }

  addEmploye(employe: Employee): Observable<any> {
    return this.http.post(`${environment.apiUrl}/employee`, employe, {
      responseType: 'text'
    });
  }

  updateEmploye(employee: Employee): Observable<any> {
    return this.http.put(`${environment.apiUrl}/employee`, employee, {
      responseType: 'text'
    });
  }
}
