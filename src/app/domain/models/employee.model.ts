export interface Employee{
  id?: string,
  partnerCode: string,
  document: string,
  name: string,
  email: string,
  ativo: boolean,
  managerCode: string,
  birthday: Date,

  /**
   * Hierarquia, agora vinda do cadastro de Estrutura Organizacional em vez de
   * um enum no codigo. `hierarchyName` acompanha na resposta, como
   * `positionName` ja fazia.
   */
  hierarchyId?: string | null,
  hierarchyName?: string | null,

  /**
   * **Nao existe mais `department` no funcionario.**
   *
   * O departamento vem do Setor: um `Team` pertence a um `Department`, entao
   * escolher o setor ja decide o departamento. Guardar os dois deixava o mesmo
   * fato escrito em dois vocabularios que podiam se contradizer — o enum
   * misturava linha de negocio (`RESTAURANTES`, `AUTOMOTIVO`) com departamento
   * de verdade (`PRODUCAO`), e nada mantinha os dois de acordo.
   *
   * O `HrDashboardService` da API ja lia por esse caminho antes desta mudanca.
   */
  companyId?: string | null,
  teamId?: string | null,
  positionId?: string | null,
  positionLevelId?: string | null,
  positionName?: string | null,
  positionLevelName?: string | null,
  contractType?: ContractType | null,
  hiringDate?: Date | string | null,
  salary?: number | null,
  transportType?: TransportType | null,
  dailyCommutesCount?: number | null,
  dailyMealsCount?: number | null,
  ticketPrice?: number | null,
  vehicleKmPerLiter?: number | null,
  dailyDistanceKm?: number | null,
  vacationBalanceDays?: number | null,
}

export enum ContractType {
  CLT = 'CLT',
  PJ = 'PJ'
}

export enum TransportType {
  MUNICIPAL_BUS = 'MUNICIPAL_BUS',
  INTERMUNICIPAL_BUS = 'INTERMUNICIPAL_BUS',
  VEHICLE = 'VEHICLE',
}
