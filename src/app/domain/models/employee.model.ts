export interface Employee{
  partnerCode: string,
  document: string,
  name: string,
  email: string,
  ativo: boolean,
  managerCode: string,
  hierarchy: Hierarchy,
  birthday: Date,
  department: Department
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
