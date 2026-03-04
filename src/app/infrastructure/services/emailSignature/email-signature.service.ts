import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmailSignatureRequest } from '../../../domain/models/emailSignature.model';

@Injectable({
  providedIn: 'root',
})
export class EmailSignatureService {

  private readonly url = `${environment.apiUrl}/email/signature`;

  constructor(private http: HttpClient) {}

  preview(data: Omit<EmailSignatureRequest, 'preview'>): Observable<Blob> {
    return this.http.post(this.url, { ...data, preview: true }, { responseType: 'blob' });
  }

  generate(data: Omit<EmailSignatureRequest, 'preview'>): Observable<Blob> {
    return this.http.post(this.url, { ...data, preview: false }, { responseType: 'blob' });
  }

  downloadBlob(blob: Blob, filename = 'assinatura_email.png'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  blobToObjectUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

}
