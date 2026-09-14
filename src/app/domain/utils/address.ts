// ═══════════════════════════════════════════════════════════════════════════
// Endereço: o texto do mapa, os links dos apps de rota e o CEP
//
// Tudo por endereço em texto, sem chave de API e sem latitude/longitude —
// decisão dele em 2026-09-14. O custo, anotado no mockup: endereço incompleto
// abre no lugar errado. Por isso o formulário mostra o mapa antes de salvar.
// ═══════════════════════════════════════════════════════════════════════════

import { Address } from '../models/address.model';

const temTexto = (v: string | null | undefined): v is string => !!v && v.trim().length > 0;

/**
 * "Av. Colombo, 5790 - Zona 7, Maringá - PR, 87020-900" — o mesmo formato do
 * `Address.formatted()` da API, para o formulário mostrar o mapa enquanto se
 * digita, antes de salvar.
 *
 * O complemento fica de fora: "Bloco A" confunde a busca e não muda o ponto.
 */
export function formatAddress(a: Address | null | undefined): string {
  if (!a) return '';

  const rua = temTexto(a.street)
    ? (temTexto(a.number) ? `${a.street.trim()}, ${a.number.trim()}` : a.street.trim())
    : '';

  const partes = [rua, temTexto(a.district) ? a.district.trim() : ''].filter(Boolean);
  let linha = partes.join(' - ');

  const cidade = temTexto(a.city)
    ? (temTexto(a.state) ? `${a.city.trim()} - ${a.state.trim().toUpperCase()}` : a.city.trim())
    : '';

  if (cidade) linha = linha ? `${linha}, ${cidade}` : cidade;
  if (temTexto(a.zipCode)) linha = linha ? `${linha}, ${a.zipCode.trim()}` : a.zipCode.trim();

  return linha;
}

/** Sem rua e sem cidade não há o que mandar para o mapa. É a mesma regra da API. */
export function isUsableAddress(a: Address | null | undefined): boolean {
  return !!a && temTexto(a.street) && temTexto(a.city);
}

export interface DirectionsLinks {
  waze: string;
  googleMaps: string;
  appleMaps: string;
  uber: string;
}

/**
 * Os quatro "Como chegar", todos por texto.
 *
 * - **Waze** e **Google Maps**: links universais, abrem o app se instalado.
 * - **Apple Maps**: `maps.apple.com` abre o Mapas no iPhone e o site no resto.
 * - **Uber**: o deep link aceita só o endereço de destino em texto
 *   (`dropoff[formatted_address]`); sem coordenadas o app pede para confirmar o
 *   ponto — é o preço de não guardar latitude e longitude.
 */
export function directionsLinks(texto: string): DirectionsLinks {
  const q = encodeURIComponent(texto);
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    appleMaps: `https://maps.apple.com/?q=${q}`,
    uber: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff%5Bformatted_address%5D=${q}`,
  };
}

/**
 * O mapa embutido, sem chave (decisão dele).
 *
 * `output=embed` é um recurso gratuito do Google que não é a Maps Embed API
 * oficial: se um dia parar, a troca é esta função — a oficial muda só a URL e
 * pede `key=`.
 */
export function mapEmbedUrl(texto: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(texto)}&z=16&output=embed`;
}

/** "87020900" e "87020-900" viram "87020900"; qualquer outra coisa, null. */
export function onlyZipDigits(valor: string | null | undefined): string | null {
  const digitos = (valor ?? '').replace(/\D/g, '');
  return digitos.length === 8 ? digitos : null;
}

/** Máscara do CEP enquanto se digita: 87020-900. */
export function maskZip(valor: string | null | undefined): string {
  const d = (valor ?? '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
