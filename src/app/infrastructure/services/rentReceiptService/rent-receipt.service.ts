import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  GenerateRequestV2,
  ReceiptBatchDetail,
  ReceiptBatchSummary,
  ReportPreviewDTO,
} from '../../../domain/models/rentReceipt.model';

@Injectable({ providedIn: 'root' })
export class RentReceiptService {
  private base = `${environment.apiUrl}/machine/contract`;

  constructor(private http: HttpClient) {}

  uploadFile(file: File): Observable<ReportPreviewDTO> {
    const formData = new FormData();
    formData.append('spreadsheet', file);
    return this.http.post<ReportPreviewDTO>(`${this.base}/preview`, formData);
  }

  generateReceipts(request: {
    processId: string;
    mesReferencia: string;
    vencimentos: Record<string, string>;
  }): Observable<Blob> {
    return this.http.post(`${this.base}/generate`, request, { responseType: 'blob' });
  }

  generateReceiptsV2(request: GenerateRequestV2): Observable<Blob> {
    return this.http.post(`${this.base}/generate/v2`, request, { responseType: 'blob' });
  }

  getReceiptBatches(month?: string, year?: number): Observable<ReceiptBatchSummary[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year.toString());
    return this.http.get<ReceiptBatchSummary[]>(`${this.base}/receipts`, { params });
  }

  getReceiptBatchDetail(batchId: string): Observable<ReceiptBatchDetail> {
    return this.http.get<ReceiptBatchDetail>(`${this.base}/receipts/${batchId}`);
  }

  downloadBatchZip(batchId: string): Observable<Blob> {
    return this.http.get(`${this.base}/receipts/${batchId}/download`, { responseType: 'blob' });
  }

  downloadSingleReceipt(receiptId: string): Observable<Blob> {
    return this.http.get(`${this.base}/receipts/file/${receiptId}`, { responseType: 'blob' });
  }

  downloadSpreadsheetModel(): Observable<Blob> {
    return this.http.get(`${this.base}/spreadsheet/model`, { responseType: 'blob' });
  }
}
