import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../../../../environments/environment";
import {Observable} from "rxjs";
import {ProfileCreateDto, ProfileResponseDto, ProfileUpdateDto} from "../../../../domain/models/profile.model";
import {map} from "rxjs/operators";

@Injectable({
  providedIn: 'root',
})
export class VcardService {
  constructor(private http: HttpClient) {  }

  private base = `${environment.apiUrl}/profile`;

  getAll(): Observable<ProfileResponseDto[]> {
    return this.http.get<ProfileResponseDto[]>(this.base);
  }

  getById(id: string): Observable<ProfileResponseDto> {
    return this.http.get<ProfileResponseDto>(`${this.base}/${id}`);
  }

  getBySlug(slug: string): Observable<ProfileResponseDto> {
    return this.http.get<ProfileResponseDto>(`${this.base}/public/${slug}`);
  }

  create(dto: ProfileCreateDto): Observable<ProfileResponseDto> {
    return this.http.post<ProfileResponseDto>(this.base, dto);
  }

  update(id: string, dto: ProfileUpdateDto): Observable<ProfileResponseDto> {
    return this.http.put<ProfileResponseDto>(`${this.base}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  downloadVCard(slug: string): Observable<Blob> {
    return this.http.get(`${this.base}/public/${slug}/vcard`, { responseType: 'blob' });
  }
}
