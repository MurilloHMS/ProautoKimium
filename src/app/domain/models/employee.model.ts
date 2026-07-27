export interface Employee{
  id?: string,
  partnerCode: string,
  document: string,
  name: string,
  email: string,
  ativo: boolean,
  managerCode: string,
  hierarchy: Hierarchy,
  birthday: Date,
  department: Department,
  companyId?: string | null,
  teamId?: string | null,
  positionId?: string | null,
  positionLevelId?: string | null,
  contractType?: ContractType | null,
  hiringDate?: Date | string | null,
  transportType?: TransportType | null,
  dailyCommutesCount?: number | null,
  ticketPrice?: number | null,
  vehicleKmPerLiter?: number | null,
  dailyDistanceKm?: number | null,
}

export enum ContractType {
  CLT = 'CLT',
  PJ = 'PJ'
}

export enum Hierarchy {
  DIRETOR = 'DIRETOR',
  CEO = 'CEO',
  SUPERVISOR = 'SUPERVISOR',
  GERENTE = 'GERENTE',
  COORDENADOR = 'COORDENADOR',
  ANALISTA = 'ANALISTA',
  ASSISTENTE = 'ASSISTENTE'
}

export enum TransportType {
  MUNICIPAL_BUS = 'MUNICIPAL_BUS',
  INTERMUNICIPAL_BUS = 'INTERMUNICIPAL_BUS',
  VEHICLE = 'VEHICLE',
}

export enum Department {
  RESTAURANTES = 'RESTAURANTES',
  AUTOMOTIVO = 'AUTOMOTIVO',
  ALIMENTOS = 'ALIMENTOS',
  SUL = 'SUL',
  EQUIPAMENTOS = 'EQUIPAMENTOS',
  LAVANDERIA = 'LAVANDERIA',
  MOTORISTA = 'MOTORISTA',
  MANUTENCAO = 'MANUTENCAO',
  DISTRIBUIDORES = 'DISTRIBUIDORES',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  PRODUCAO = 'PRODUCAO'
}
