export interface TelefoneContatoDto {
  tipo: string;
  numero: string;
}

export interface RedeSocialDto {
  tipo: string;
  url: string;
}

export interface ProfileResponseDto {
  id: string;
  nome: string;
  slug: string;
  cargo: string;
  empresa: string;
  email: string;
  imagem: string;
  descricao: string;
  telefones: TelefoneContatoDto[];
  redesSociais: RedeSocialDto[];
  regioesAtendimento: string[];
  segmentosAtendimento: string[];
  ativo: boolean;
}

export interface ProfileCreateDto {
  nome: string;
  slug: string;
  cargo: string;
  empresa: string;
  email: string;
  imagem: string;
  descricao: string;
  telefones: TelefoneContatoDto[];
  redesSociais: RedeSocialDto[];
  regioesAtendimento: string[];
  segmentosAtendimento: string[];
  ativo: boolean;
}

export type ProfileUpdateDto = ProfileCreateDto;
