import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Announcement, PublishAnnouncementPayload } from '../../../domain/models/hr/announcement.model';

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {

  constructor(private http: HttpClient) {}

  /** Mural completo, mais recente primeiro — aberto a qualquer funcionário autenticado. */
  getAll(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(`${environment.apiUrl}/hr/announcements`);
  }

  publish(payload: PublishAnnouncementPayload): Observable<Announcement> {
    return this.http.post<Announcement>(`${environment.apiUrl}/hr/announcements`, payload);
  }
}
