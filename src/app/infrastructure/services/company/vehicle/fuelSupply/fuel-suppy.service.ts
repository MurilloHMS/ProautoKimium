import { Injectable } from '@angular/core';
import {FuelSupplyReportRequest, ReportFormat} from "../../../../../domain/models/report.model";
import {environment} from "../../../../../../environments/environment";
import {Observable} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {file} from "@primeuix/themes/aura/fileupload";

@Injectable({
  providedIn: 'root',
})
export class FuelSuppyService {
  constructor(private http: HttpClient) {}

  generateReport(request: FuelSupplyReportRequest): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/fuelsupply`, request, {
      responseType: 'blob'
    });
  }

  downloadFile(blob: Blob, format: ReportFormat, mes: number, ano: number): void {
    const mimeType  = format === 'PDF'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const extension = format === 'PDF' ? 'pdf' : 'xlsx';
    const filename  = `abastecimento_${this.padMes(mes)}_${ano}.${extension}`;

    const file = new Blob([blob], { type: mimeType });
    const url  = URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href     = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  private padMes(mes: number): string {
    return String(mes).padStart(2, '0');
  }

  uploadSpreadsheet(selectedFile: File, selectedMonth: number, selectedYear: number) {
    const formData = new FormData();
    formData.append('file', selectedFile);
    return this.http.post(`${environment.apiUrl}/fuelsupply/upload`, formData, {responseType: 'text'});

  }
}
