/**
 * Endereço brasileiro em partes — o `AddressDTO` da API.
 *
 * O mesmo formato nas empresas do RH, nos eventos e nas palestras.
 */
export interface Address {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  /**
   * O ponto no mapa, descoberto no Nominatim ao salvar. **Sempre os dois ou
   * nenhum** — é o CHECK da V107, e meia coordenada não localiza nada.
   *
   * Sem isso o Uber abre pedindo o destino: ele roteia por coordenada, e o
   * endereço em texto serve só de rótulo. Ver `uberLink` em `utils/address`.
   */
  latitude?: number | null;
  longitude?: number | null;
  /** Só na resposta: o texto que vai para o mapa e para os apps de rota. */
  formatted?: string | null;
}

export function emptyAddress(): Address {
  return {
    zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null,
    latitude: null, longitude: null,
  };
}
