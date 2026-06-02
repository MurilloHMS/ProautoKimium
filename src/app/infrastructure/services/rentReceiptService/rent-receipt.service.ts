import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../../../environments/environment";
import {ReportPreviewDTO} from "../../../domain/models/rentReceipt.model";

@Injectable({
  providedIn: 'root',
})
export class RentReceiptService {
  constructor(private http: HttpClient) { }

  uploadFile(file: File){
    const formData = new FormData();
    formData.append('spreadsheet', file);

    return this.http.post<ReportPreviewDTO>(`${environment.apiUrl}/machine/contract/preview`, formData);
  }

  generateReceipts(request: {
    processId: string;
    mesReferencia: string;
    vencimentos: Record<string, string>;
  }) {
    return this.http.post(
      `${environment.apiUrl}/machine/contract/generate`,
      request,
      { responseType: 'blob' }
    );
  }
}
