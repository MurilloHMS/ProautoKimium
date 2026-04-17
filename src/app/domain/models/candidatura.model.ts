export type EtapaCandidatura = 'TRIAGEM' | 'ENTREVISTA_RH' | 'PROPOSTA' | 'CONTRATADO';
export type StatusCandidatura = 'EM_ANDAMENTO' | 'APROVADO' | 'REPROVADO' | 'ENCERRADO';

export interface CreateCandidaturaDTO {
  vagaID: string;       // UUID da vaga
  nome: string;
  email: string;
  telefone: string;
  urlLinkedin: string;
}

export interface ResponseCandidaturaDTO {
  id: string;
  candidatoNome: string;
  candidatoEmail: string;
  candidatoTelefone: string;
  candidatoLinkedin: string;
  candidatoCurriculo: string;
  vagaTitulo: string;
  etapaAtual: EtapaCandidatura;
  status: StatusCandidatura;
  criadoEm: string;
  atualizadoEm: string | null;
}

export const ETAPAS_CONFIG: Record<EtapaCandidatura, { label: string; icon: string; ordem: number }> = {
  TRIAGEM:        { label: 'Triagem',        icon: 'pi-filter',     ordem: 1 },
  ENTREVISTA_RH:  { label: 'Entrevista RH',  icon: 'pi-users',      ordem: 2 },
  PROPOSTA:       { label: 'Proposta',        icon: 'pi-file-edit',  ordem: 3 },
  CONTRATADO:     { label: 'Contratado',      icon: 'pi-check',      ordem: 4 },
};

export const STATUS_CONFIG: Record<StatusCandidatura, { label: string; color: string }> = {
  EM_ANDAMENTO: { label: 'Em andamento', color: 'info'    },
  APROVADO:     { label: 'Aprovado',     color: 'success' },
  REPROVADO:    { label: 'Reprovado',    color: 'danger'  },
  ENCERRADO:    { label: 'Encerrado',    color: 'neutral' },
};
