import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MedicalCertificate, MedicalCertificateStatus, SubmissionType } from '../../../domain/models/hr/medical-certificate.model';

export interface ResubmitMedicalCertificatePayload {
  submissionType: SubmissionType;
  confirmedLegible: boolean | null;
  comment: string | null;
  file: File;
}

export interface SubmitMedicalCertificatePayload {
  startDate: string;
  endDate: string;
  submissionType: SubmissionType;
  confirmedLegible: boolean | null;
  file: File;
}

@Injectable({
  providedIn: 'root'
})
export class MedicalCertificateService {

  constructor(private http: HttpClient) {}

  getMine(): Observable<MedicalCertificate[]> {
    return this.http.get<MedicalCertificate[]>(`${environment.apiUrl}/hr/medical-certificates/me`);
  }

  getAll(status?: MedicalCertificateStatus | null): Observable<MedicalCertificate[]> {
    const params: Record<string, string> = status ? { status } : {};
    return this.http.get<MedicalCertificate[]>(`${environment.apiUrl}/hr/medical-certificates`, { params });
  }

  /** O RH confirma que recebeu. Observação opcional. */
  confirmReceipt(id: string, notes: string | null): Observable<MedicalCertificate> {
    return this.http.post<MedicalCertificate>(`${environment.apiUrl}/hr/medical-certificates/${id}/receive`, { notes });
  }

  /** O RH recusa; o motivo é obrigatório e é o que a pessoa lê para reenviar. */
  reject(id: string, notes: string): Observable<MedicalCertificate> {
    return this.http.post<MedicalCertificate>(`${environment.apiUrl}/hr/medical-certificates/${id}/reject`, { notes });
  }

  /** Quem enviou manda outro arquivo para o atestado recusado. */
  resubmit(id: string, payload: ResubmitMedicalCertificatePayload): Observable<MedicalCertificate> {
    const formData = new FormData();
    formData.append('submissionType', payload.submissionType);
    if (payload.confirmedLegible !== null) {
      formData.append('confirmedLegible', String(payload.confirmedLegible));
    }
    if (payload.comment) {
      formData.append('comment', payload.comment);
    }
    formData.append('file', payload.file);
    return this.http.post<MedicalCertificate>(`${environment.apiUrl}/hr/medical-certificates/${id}/resubmit`, formData);
  }

  /** Um arquivo recusado da trilha. */
  downloadAttempt(id: string, attemptId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${environment.apiUrl}/hr/medical-certificates/${id}/attempts/${attemptId}/file`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  submit(payload: SubmitMedicalCertificatePayload): Observable<MedicalCertificate> {
    const formData = new FormData();
    formData.append('startDate', payload.startDate);
    formData.append('endDate', payload.endDate);
    formData.append('submissionType', payload.submissionType);
    if (payload.confirmedLegible !== null) {
      formData.append('confirmedLegible', String(payload.confirmedLegible));
    }
    formData.append('file', payload.file);

    return this.http.post<MedicalCertificate>(`${environment.apiUrl}/hr/medical-certificates`, formData);
  }

  download(id: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${environment.apiUrl}/hr/medical-certificates/${id}/file`, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}
