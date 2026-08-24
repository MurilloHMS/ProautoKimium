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

    addCertificateWithoutValidation(certificate: Certificate) {
      return this.http.post(
        `${environment.apiUrl}/certificate/no-validation`,
        certificate,
        {
          responseType: 'blob',
          observe: 'response'
        }
      );
    }

    /**
     * Um certificado por nome, tudo num ZIP.
     *
     * `observe: 'response'` porque o nome do arquivo vem no Content-Disposition,
     * e `responseType: 'blob'` porque o corpo é binário — inclusive quando dá
     * erro, então a mensagem de validação chega como Blob e precisa ser lida.
     *
     * Só ADMIN: a API recusa o resto com 403. Os outros dois endpoints daqui
     * são públicos, este não é — lista aberta ao público é derrubar o servidor
     * com um `curl`.
     */
    generateBatch(names: string[]) {
      return this.http.post(
        `${environment.apiUrl}/certificate/batch`,
        { names },
        {
          responseType: 'blob',
          observe: 'response'
        }
      );
    }
}
