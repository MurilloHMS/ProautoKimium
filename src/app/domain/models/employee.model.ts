export interface Employee{
  id?: string, // presente na resposta da API; opcional pra não quebrar telas antigas que montam Employee só com os campos do form
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
  // Só usados na criação — cargo/nível/contrato geram o primeiro CareerHistory (HIRING) e não são editáveis por aqui depois
  positionId?: string | null,
  positionLevelId?: string | null,
  contractType?: ContractType | null,
  hiringDate?: Date | string | null
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
