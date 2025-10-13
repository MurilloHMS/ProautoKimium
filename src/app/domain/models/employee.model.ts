export interface Employee{
  partnerCode: string,
  document: string,
  name: string,
  email: string,
  ativo: boolean,
  managerCode: string,
  hierarchy: Hierarchy,
  birthday: Date
}

export enum Hierarchy{
  DIRETOR,
  CEO,
  SUPERVISOR,
  GERENTE,
  COORDENADOR,
  ANALISTA,
  ASSISTENTE
}
