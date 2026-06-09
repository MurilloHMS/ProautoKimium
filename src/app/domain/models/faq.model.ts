export type StatusPostagem = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

export interface FaqResponseDTO {
  id: string;
  title: string;
  body: string;
  status: StatusPostagem;
}

export interface FaqPublicResponseDTO {
  title: string;
  body: string;
  status: StatusPostagem;
}
