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

export enum Hierarchy{
  DIRETOR,
  CEO,
  SUPERVISOR,
  GERENTE,
  COORDENADOR,
  ANALISTA,
  ASSISTENTE
}

export enum Department {
	RESTAURANTES,
	AUTOMOTIVO,
	ALIMENTOS,
	SUL,
	EQUIPAMENTOS,
	LAVANDERIA,
	MOTORISTA,
	MANUTENCAO,
	DISTRIBUIDORES,
	ADMINISTRATIVO,
	PRODUCAO
}
