import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MedicalCertificate, SubmissionType } from '../../../domain/models/hr/medical-certificate.model';

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

  download(id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/hr/medical-certificates/${id}/file`, {
      responseType: 'blob'
    });
  }
}
