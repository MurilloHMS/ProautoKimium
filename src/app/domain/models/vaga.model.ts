export interface ResponseVagaDTO {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string;
  beneficios: string;
  area: string;
  dataAbertura: string;
  dataEncerramento: string;
}

export interface CreateVagaDTO {
  titulo: string;
  descricao: string;
  requisitos: string;
  beneficios: string;
  area: string;
  dataAbertura: string;
  dataEncerramento: string;
}

export interface UpdateVagaDTO {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string;
  beneficios: string;
  area: string;
  dataAbertura: string;
  dataEncerramento: string;
}
