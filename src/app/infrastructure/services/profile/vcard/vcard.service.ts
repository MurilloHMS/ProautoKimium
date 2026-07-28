import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../../../../environments/environment";
import {Observable} from "rxjs";
import {MyProfileResponseDto, ProfileCreateDto, ProfileResponseDto, ProfileUpdateDto} from "../../../../domain/models/profile.model";

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

  getMyProfile(): Observable<MyProfileResponseDto> {
    return this.http.get<MyProfileResponseDto>(`${this.base}/me`);
  }

  createMyProfile(dto: ProfileCreateDto): Observable<ProfileResponseDto> {
    return this.http.post<ProfileResponseDto>(`${this.base}/me`, dto);
  }

  updateMyProfile(dto: ProfileUpdateDto): Observable<ProfileResponseDto> {
    return this.http.put<ProfileResponseDto>(`${this.base}/me`, dto);
  }

  uploadMyProfileImage(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.base}/me/image`, formData, { responseType: 'text' });
  }
}
