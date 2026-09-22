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

/**
 * O Brasil, em caixa retangular grosseira.
 *
 * Não serve para validar endereço — serve para uma coisa só: reconhecer o par
 * **invertido**, que é o erro mais comum de quem digita coordenada à mão e o
 * único que é totalmente silencioso. `-46.45, -23.65` é um ponto perfeitamente
 * válido, e fica no Atlântico.
 */
const BRASIL = { latMin: -34, latMax: 6, lonMin: -74, lonMax: -34 };

const dentroDoBrasil = (lat: number, lon: number): boolean =>
  lat >= BRASIL.latMin && lat <= BRASIL.latMax && lon >= BRASIL.lonMin && lon <= BRASIL.lonMax;

/** O par está trocado de lugar? Só afirma quando inverter resolve. */
export function looksSwapped(p: Coordinates): boolean {
  return !dentroDoBrasil(p.latitude, p.longitude)
      && dentroDoBrasil(p.longitude, p.latitude);
}

/**
 * Coordenada digitada à mão → o ponto, quando dá para entender.
 *
 * Existe porque **o Nominatim não conhece todo endereço**. Em 2026-09-22 ele
 * caiu num real: `Avenida João do Prado, 300 - Polo Petroquímico de Capuava,
 * Santo André - SP`. Medido no dia: o OpenStreetMap tem a cidade e tem o
 * bairro, e **não tem a rua** — em nenhuma forma de consulta, nem na
 * estruturada. O Google e o Waze têm, que é por que o mapa embutido mostrava
 * enquanto a busca dizia "não encontrei".
 *
 * Aceita as duas coisas que costumam estar na área de transferência:
 *
 * - o par que o Google Maps copia no botão direito — `-23.652, -46.456`;
 * - a **URL** do Google Maps, de onde o `@lat,lon` ou o `q=lat,lon` é extraído.
 *
 * Devolve `null` para qualquer outra coisa, inclusive para número fora de
 * faixa. Não julga se o ponto é o certo — só se é um ponto.
 */
export function parseCoordinates(texto: string | null | undefined): Coordinates | null {
  const bruto = (texto ?? '').trim();
  if (!bruto) return null;

  // Numa URL o par vem depois de `@` ou de `q=`; fora dela, é o texto inteiro.
  //
  // A âncora `[@=]` não é enfeite, e nem é sobre o zoom — medido em 2026-09-22,
  // o `17z` no fim da URL não engana nenhuma das duas formas. Ela é sobre
  // **pedaço de endereço colado por engano**: sem a âncora, `Rua 25, 30` casa e
  // vira um ponto no Egito, que o `looksSwapped` não acusa porque nenhuma das
  // duas orientações cai no Brasil.
  const daUrl = bruto.match(/[@=](-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  const solto = bruto.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  const achado = solto ?? daUrl;
  if (!achado) return null;

  const latitude = Number(achado[1]);
  const longitude = Number(achado[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  // 0,0 é o Golfo da Guiné, e quase sempre é campo vazio virando número.
  if (latitude === 0 && longitude === 0) return null;

  return { latitude: round6(latitude), longitude: round6(longitude) };
}

/** Seis casas — o mesmo NUMERIC(9,6) do banco, cerca de 11 cm. */
function round6(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
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
