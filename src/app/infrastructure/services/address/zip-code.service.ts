import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';

import { Address } from '../../../domain/models/address.model';
import { onlyZipDigits } from '../../../domain/utils/address';

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

/**
 * CEP → rua, bairro, cidade e UF, pelo ViaCEP.
 *
 * **`HttpBackend` e não o `HttpClient` do app.** O do app passa pelo
 * interceptor, que põe o JWT em toda requisição — e o token da pessoa não pode
 * ir para um serviço de fora.
 *
 * **Nunca falha para quem chama.** CEP inexistente, ViaCEP fora do ar ou lento:
 * devolve `null`, e os campos ficam livres para digitar. Endereço é opcional na
 * empresa, e travar o formulário porque um serviço gratuito caiu seria pior.
 */
@Injectable({ providedIn: 'root' })
export class ZipCodeService {
  private readonly http = new HttpClient(inject(HttpBackend));

  lookup(cep: string | null | undefined): Observable<Partial<Address> | null> {
    const digitos = onlyZipDigits(cep);
    if (!digitos) return of(null);

    return this.http.get<ViaCepResponse>(`https://viacep.com.br/ws/${digitos}/json/`).pipe(
      timeout(5000),
      map(r => r?.erro ? null : {
        zipCode: `${digitos.slice(0, 5)}-${digitos.slice(5)}`,
        street: r.logradouro || null,
        district: r.bairro || null,
        city: r.localidade || null,
        state: r.uf || null,
      }),
      catchError(() => of(null)),
    );
  }
}
