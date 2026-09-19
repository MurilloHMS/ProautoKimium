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

/** O ponto no mapa, quando o geocodificador achou. Sempre os dois juntos. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** O ponto do endereço, ou `null` quando ele não foi localizado. */
export function coordinatesOf(a: Address | null | undefined): Coordinates | null {
  return typeof a?.latitude === 'number' && typeof a?.longitude === 'number'
    ? { latitude: a.latitude, longitude: a.longitude }
    : null;
}

export interface DirectionsLinks {
  waze: string;
  googleMaps: string;
  appleMaps: string;
  /** `null` sem coordenadas — ver `uberLink`. */
  uber: string | null;
}

/**
 * Os quatro "Como chegar", todos por texto.
 *
 * - **Waze** e **Google Maps**: links universais, abrem o app se instalado.
 * - **Apple Maps**: `maps.apple.com` abre o Mapas no iPhone e o site no resto.
 * - **Uber**: ver `uberLink` — é o único que não busca por texto solto.
 */
export function directionsLinks(texto: string, ponto?: Coordinates | null): DirectionsLinks {
  const q = encodeURIComponent(texto);
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    appleMaps: `https://maps.apple.com/?q=${q}`,
    uber: ponto ? uberLink(texto, ponto) : null,
  };
}

/**
 * O destino do Uber — o único dos quatro que **não** procura por texto.
 *
 * <p>Descoberto no duro em 2026-09-19: ele testou os quatro botões no iPhone e
 * só o Uber abriu pedindo para digitar o destino. Eram dois erros somados.
 *
 * 1. O formato antigo daqui era `dropoff[formatted_address]`, sintaxe do Ride
 *    Request Widget, que a Uber aposentou. Parâmetro que ela não conhece é
 *    ignorado calado — nenhum erro, só o app abrindo vazio. O link de hoje quer
 *    `drop`, uma **lista** de objetos `Location` em JSON.
 * 2. Mesmo no formato certo, o texto não basta. A documentação do `Location` diz
 *    de `addressLine2`: *"will not override the latitude/longitude"*. As duas
 *    linhas de endereço são o **rótulo do pino**; quem localiza é o par de
 *    números. O único campo que a Uber aceita sem coordenada é `pickup`, e só
 *    porque `my_location` o app resolve sozinho.
 *
 * Por isso `directionsLinks` devolve `null` aqui quando o endereço não tem
 * ponto: botão que abre o app em branco é pior do que botão nenhum. Waze, Google
 * Maps e Apple Maps continuam saindo sempre — esses sabem procurar por texto.
 *
 * Os colchetes vão codificados porque `[` e `]` não valem em query string; o
 * servidor da Uber decodifica antes de ler.
 */
function uberLink(texto: string, ponto: Coordinates): string {
  const destino = encodeURIComponent(JSON.stringify({
    latitude: ponto.latitude,
    longitude: ponto.longitude,
    addressLine1: texto,
  }));
  return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&drop%5B0%5D=${destino}`;
}

/**
 * O mapa embutido, sem chave (decisão dele).
 *
 * Com o ponto, a URL leva a coordenada e o mapa cai exatamente nela; sem ele,
 * leva o texto e o Google procura — o que às vezes para no centro da cidade.
 * Era o risco anotado no mockup quando ele escolheu o mapa sem chave, e que as
 * coordenadas guardadas desde a V107 tiram do caminho.
 *
 * `output=embed` é um recurso gratuito do Google que não é a Maps Embed API
 * oficial: se um dia parar, a troca é esta função — a oficial muda só a URL e
 * pede `key=`.
 */
export function mapEmbedUrl(texto: string, ponto?: Coordinates | null): string {
  const q = ponto ? `${ponto.latitude},${ponto.longitude}` : texto;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${ponto ? 17 : 16}&output=embed`;
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
