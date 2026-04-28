import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../../../../environments/environment";
import {
  CreateSecretRequest,
  CreateSecretResponse,
  SecretContentResponse
} from "../../../../domain/models/secrets.model";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root',
})
export class SecretsService {
  constructor(private http: HttpClient) { }

  getSecret(token : string) : Observable<SecretContentResponse> {
    return this.http.get<SecretContentResponse>(`${environment.apiUrl}/public-secrets/${token}`);
  }

  createSecret(content: CreateSecretRequest): Observable<CreateSecretResponse> {
    return this.http.post<CreateSecretResponse>(`${environment.apiUrl}/public-secrets`, content);
  }
}
