import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';

import { Coordinates } from '../../../domain/utils/address';

interface NominatimResult {
  lat?: string;
  lon?: string;
}

/**
 * Endereço em texto → o ponto no mapa, pelo Nominatim do OpenStreetMap.
 *
 * **Por que existe.** O Uber roteia por coordenada: com o endereço só em texto,
 * o app abre pedindo o destino (ele viu no iPhone em 2026-09-19). O ponto
 * também endireita o mapa embutido, que antes era uma busca por texto e às
 * vezes parava no centro da cidade.
 *
 * **Uma vez, ao salvar**, e não a cada vez que alguém abre a tela: endereço se
 * digita de vez em quando e se lê o tempo todo. O par fica guardado nas colunas
 * `address_latitude`/`address_longitude` (V107).
 *
 * **Sem chave, como o mapa** — foi a escolha dele. O preço é a política de uso
 * do Nominatim: serviço gratuito, um pedido por segundo, sem uso pesado. O
 * volume aqui é de um punhado de endereços por mês, bem dentro disso; se um dia
 * virar cadastro em massa, é hora de um geocodificador com chave.
 *
 * **`HttpBackend` e não o `HttpClient` do app**, pelo mesmo motivo do
 * `ZipCodeService`: o interceptor põe o JWT em toda requisição, e o token da
 * pessoa não pode ir para um serviço de fora.
 *
 * **Nunca falha para quem chama.** Endereço que o Nominatim não acha, serviço
 * fora do ar ou lento: devolve `null`, e o endereço é salvo sem ponto. Travar o
 * cadastro de um evento porque um serviço gratuito caiu seria pior do que ficar
 * sem o botão do Uber.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = new HttpClient(inject(HttpBackend));

  lookup(texto: string | null | undefined): Observable<Coordinates | null> {
    const busca = (texto ?? '').trim();
    if (busca.length < 8) return of(null);

    // `countrycodes=br` evita a Maringá do Maranhão e as homônimas de fora.
    const url = 'https://nominatim.openstreetmap.org/search'
      + `?q=${encodeURIComponent(busca)}&countrycodes=br&format=json&limit=1`;

    return this.http.get<NominatimResult[]>(url).pipe(
      timeout(6000),
      map(r => this.primeiro(r)),
      catchError(() => of(null)),
    );
  }

  private primeiro(resultados: NominatimResult[] | null): Coordinates | null {
    const achado = resultados?.[0];
    if (!achado) return null;

    const latitude = Number(achado.lat);
    const longitude = Number(achado.lon);
    // O Nominatim devolve os números como texto; `Number('')` é 0, e 0,0 fica
    // no Golfo da Guiné. Um par inválido tem que virar "sem ponto".
    return Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)
      ? { latitude: arredondar(latitude), longitude: arredondar(longitude) }
      : null;
  }
}

/** Seis casas — o mesmo NUMERIC(9,6) do banco, cerca de 11 cm. */
function arredondar(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}
