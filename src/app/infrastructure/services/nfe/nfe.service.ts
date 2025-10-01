import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NfeService {
  constructor(private http: HttpClient) { }

  processXmlFiles(files: File[], type: 'nfe' | 'icms') {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    if (type === 'nfe') {
      return this.http.post(`${environment.apiUrl}/nfe/process/upload`, formData, { responseType: 'blob' });
    } else {
      return this.http.post(`${environment.apiUrl}/nfe/icms/upload`, formData, { responseType: 'blob' });
    }

  }
}
