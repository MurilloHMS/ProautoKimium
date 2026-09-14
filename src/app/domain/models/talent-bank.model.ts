// ═══════════════════════════════════════════════════════════════════════════
// Banco de talentos
//
// Espelha os DTOs de `processoSeletivo/talentBank` da API. Datas chegam como
// `LocalDateTime` sem fuso ("2026-09-14T10:32:00"), e é assim que ficam aqui.
// ═══════════════════════════════════════════════════════════════════════════

/** Inscrição sem vaga. O currículo vai à parte, no multipart. */
export interface CreateTalentBankEntryDTO {
  nome: string;
  email: string;
  telefone: string;
  urlLinkedin: string;
  areaInteresse: string | null;
  consentimento: boolean;
}

/**
 * O que a pessoa corrige pelo link.
 *
 * Não tem `email`, e a API recusaria se tivesse: trocar o e-mail por token
 * moveria o cadastro para um endereço que o portador do link controla.
 */
export interface UpdateTalentBankEntryDTO {
  nome: string;
  telefone: string;
  urlLinkedin: string;
  areaInteresse: string | null;
  /** Marcar de novo renova o prazo a partir de hoje. */
  consentimento: boolean;
}

/** O que a própria pessoa vê ao abrir o link do e-mail. */
export interface TalentBankEntryDTO {
  nome: string;
  email: string;
  telefone: string;
  urlLinkedin: string | null;
  areaInteresse: string | null;
  temCurriculo: boolean;
  extensaoCurriculo: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  consentimentoEm: string | null;
  expiraEm: string | null;
  /** Só título e data: a etapa do funil é anotação interna do RH. */
  candidaturas: { vagaTitulo: string; criadoEm: string }[];
}

/** Uma linha da aba interna. */
export interface TalentBankSummaryDTO {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  urlLinkedin: string | null;
  areaInteresse: string | null;
  temCurriculo: boolean;
  espontaneo: boolean;
  quantidadeDeCandidaturas: number;
  criadoEm: string | null;
  atualizadoEm: string | null;
  consentimentoEm: string | null;
  expiraEm: string | null;
}

export type TalentBankOrigem = 'TODOS' | 'ESPONTANEO' | 'CANDIDATURA';
export type TalentBankConsentimento = 'TODOS' | 'COM' | 'SEM';
export type TalentBankSituacao = 'TODOS' | 'VIGENTE' | 'VENCIDO';

/** Os filtros que `GET /api/talent-bank` aceita, com os valores que o service compara. */
export interface TalentBankFiltros {
  q: string;
  area: string | null;
  origem: TalentBankOrigem;
  consentimento: TalentBankConsentimento;
  situacao: TalentBankSituacao;
}
