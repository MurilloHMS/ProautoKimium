import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AuthenticateCredential, AuthenticationOptions, RegisterCredential, RegistrationOptions, WebAuthnDevice,
} from '../../../domain/models/webauthn.model';
import { LoginResponseDTO } from '../../../domain/models/auth.model';

/** As rotas da digital na API (`WebAuthnController` e `EmployeeWebAuthnController`). */
@Injectable({ providedIn: 'root' })
export class WebAuthnApiService {

  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth/webauthn`;

  registrationOptions(): Observable<RegistrationOptions> {
    return this.http.post<RegistrationOptions>(`${this.base}/registration/options`, {});
  }

  register(dto: RegisterCredential): Observable<WebAuthnDevice> {
    return this.http.post<WebAuthnDevice>(`${this.base}/registration`, dto);
  }

  authenticationOptions(): Observable<AuthenticationOptions> {
    return this.http.post<AuthenticationOptions>(`${this.base}/authentication/options`, {});
  }

  authenticate(dto: AuthenticateCredential): Observable<LoginResponseDTO> {
    return this.http.post<LoginResponseDTO>(`${this.base}/authentication`, dto);
  }

  myDevices(): Observable<WebAuthnDevice[]> {
    return this.http.get<WebAuthnDevice[]>(`${this.base}/credentials`);
  }

  removeMine(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/credentials/${id}`);
  }

  employeeDevices(employeeId: string): Observable<WebAuthnDevice[]> {
    return this.http.get<WebAuthnDevice[]>(`${environment.apiUrl}/employee/${employeeId}/webauthn-credentials`);
  }

  removeFromEmployee(employeeId: string, id: string | null): Observable<void> {
    const url = `${environment.apiUrl}/employee/${employeeId}/webauthn-credentials`;
    return this.http.delete<void>(id ? `${url}/${id}` : url);
  }
}
