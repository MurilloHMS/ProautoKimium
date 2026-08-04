import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateGalleryDocumentDTO, GalleryDocument } from '../../../domain/models/gallery.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GalleryService {

  private readonly baseUrl = `${environment.apiUrl}/gallery`;

  constructor(private http: HttpClient) {}

  list(): Observable<GalleryDocument[]> {
    return this.http.get<GalleryDocument[]>(this.baseUrl);
  }

  upload(dto: CreateGalleryDocumentDTO, file: File): Observable<GalleryDocument> {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    formData.append('file', file);
    return this.http.post<GalleryDocument>(this.baseUrl, formData);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/file`, { responseType: 'blob' });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
