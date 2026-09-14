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
  /** Só na resposta: o texto que vai para o mapa e para os apps de rota. */
  formatted?: string | null;
}

export function emptyAddress(): Address {
  return { zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null };
}
