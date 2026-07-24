import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CalendarEvent, CalendarEventStatus } from '../../../domain/models/hr/calendar.model';

export interface CalendarQuery {
  start: string;
  end: string;
  teamId?: string;
  companyId?: string;
  status?: CalendarEventStatus;
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  constructor(private http: HttpClient) {}

  getEvents(query: CalendarQuery): Observable<CalendarEvent[]> {
    const params: Record<string, string> = { start: query.start, end: query.end };
    if (query.teamId) params['teamId'] = query.teamId;
    if (query.companyId) params['companyId'] = query.companyId;
    if (query.status) params['status'] = query.status;

    return this.http.get<CalendarEvent[]>(`${environment.apiUrl}/hr/calendar`, { params });
  }
}
