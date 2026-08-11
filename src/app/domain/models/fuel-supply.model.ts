/**
 * Abastecimento — uma linha da planilha importada em `POST api/fuelsupply/upload`.
 *
 * Os nomes saem do `FuelSupplyDTO` da API, inclusive `diferenceHodometer`, que
 * está escrito assim lá. Renomear aqui faria o campo chegar vazio.
 *
 * `diferenceHodometer` é a quilometragem desde o abastecimento anterior, e
 * `averageKm` o consumo que a planilha já calculou. O hub recalcula o consumo
 * a partir de km e litros: quando a planilha vem sem a média, a conta ainda sai.
 */
export interface FuelSupply {
  fuelSupplyDate: string;
  uf: string;
  plate: string;
  driverName: string;
  department: string;
  actualHodometer: number;
  lastHodometer: number;
  diferenceHodometer: number;
  averageKm: number;
  fuelType: string;
  liters: number;
  price: number;
  totalValue: number;
}
