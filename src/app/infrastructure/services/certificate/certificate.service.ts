import { Injectable } from '@angular/core';
import { Certificate } from '../../../domain/models/certificate.model';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class CertificateService {
  constructor(private http: HttpClient) {}

    addCertificate(certificate: Certificate) {
      return this.http.post(
        `${environment.apiUrl}/certificate`,
        certificate,
        {
          responseType: 'blob',
          observe: 'response'
        }
      );
    }
}
