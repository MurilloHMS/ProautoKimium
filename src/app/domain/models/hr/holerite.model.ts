/**
 * Holerites — espelha os DTOs da API.
 *
 * Estavam declarados dentro dos componentes, cada tela com a sua cópia. Com
 * três telas lendo o mesmo endpoint, a cópia que ficava para trás era a que
 * quebrava.
 */

/**
 * O código de um tipo de holerite ("SALARIO", "PLR"…). Era uma lista fixa; desde
 * 2026-10-02 os tipos são um cadastro da API, que o RH aumenta pela tela de envio.
 */
export type HoleriteTipo = string;

/** Um tipo como a API devolve (`GET /holerite/types`). */
export interface PayslipType {
  code: string;
  label: string;
}

/** Um tipo pronto para a tela: o nome inteiro, o curto do botão e o ícone. */
export interface PayslipTypeView extends PayslipType {
  curto: string;
  icon: string;
}

/**
 * Nome curto e ícone dos tipos de sempre. Tipo criado pelo RH não está aqui, e
 * usa o próprio nome e um ícone neutro: o desenho não pode depender de alguém
 * lembrar de mexer no código quando o RH criar "Bônus".
 *
 * O mês de cada parcela do 13º não está aqui de propósito — quem diz o mês é a
 * competência escolhida no envio.
 */
const VISUAL: Record<string, { curto: string; icon: string }> = {
  SALARIO: { curto: 'Salário', icon: 'pi pi-wallet' },
  ADIANTAMENTO: { curto: 'Adiantamento', icon: 'pi pi-calendar' },
  DECIMO_TERCEIRO_1: { curto: '13º · 1ª', icon: 'pi pi-gift' },
  DECIMO_TERCEIRO_2: { curto: '13º · 2ª', icon: 'pi pi-gift' },
  PLR: { curto: 'PLR', icon: 'pi pi-chart-line' },
  FERIAS_COLETIVAS: { curto: 'Férias coletivas', icon: 'pi pi-sun' },
};

export function payslipTypeView(t: PayslipType): PayslipTypeView {
  return { ...t, ...(VISUAL[t.code] ?? { curto: t.label, icon: 'pi pi-file' }) };
}

/** A resposta do cadastro: `created` falso quando o nome já existia. */
export interface CreatePayslipTypeResult {
  type: PayslipType;
  created: boolean;
}

/**
 * O que vai acontecer com cada página do PDF, decidido pelo servidor.
 *
 * É enum e não texto livre porque a tela pinta a linha a partir dele. O
 * `naoEncontrados` antigo era uma lista de frases montadas na API, e por isso
 * só dava para mostrar como uma lista solta no fim da página.
 */
export type HoleritePreviewStatus =
  | 'PRONTO'
  | 'NAO_CADASTRADO'
  | 'JA_ENVIADO'
  | 'CPF_DUPLICADO'
  | 'CPF_ILEGIVEL'
  | 'SEM_USUARIO';

export interface HoleritePreviewItem {
  pagina: number;
  nome: string | null;
  cpf: string | null;
  employeeId: string | null;
  employeeNome: string | null;
  codParceiro: string | null;
  status: HoleritePreviewStatus;
}

/** Rótulo, cor e explicação de cada situação — uma fonte só para tabela e resumo. */
export const PREVIEW_STATUS_INFO: Record<HoleritePreviewStatus, {
  label: string;
  chip: 'active' | 'warning' | 'danger' | 'neutral';
  icon: string;
  ajuda: string;
}> = {
  PRONTO: {
    label: 'Vai enviar',
    chip: 'active',
    icon: 'pi-check',
    ajuda: 'Funcionário cadastrado e sem holerite deste tipo nesta competência.',
  },
  NAO_CADASTRADO: {
    label: 'Não cadastrado',
    chip: 'danger',
    icon: 'pi-user-minus',
    ajuda: 'O CPF não bate com nenhum funcionário. Cadastre e envie o mesmo arquivo de novo — quem já recebeu não é duplicado.',
  },
  JA_ENVIADO: {
    label: 'Já enviado',
    chip: 'neutral',
    icon: 'pi-history',
    ajuda: 'Esta pessoa já tem holerite deste tipo nesta competência. A página será pulada.',
  },
  CPF_DUPLICADO: {
    label: 'CPF repetido',
    chip: 'danger',
    icon: 'pi-clone',
    ajuda: 'O mesmo CPF aparece em mais de um cadastro de funcionário. Resolva o cadastro antes de enviar.',
  },
  CPF_ILEGIVEL: {
    label: 'CPF ilegível',
    chip: 'warning',
    icon: 'pi-eye-slash',
    ajuda: 'Não foi possível ler o CPF desta página. Costuma ser PDF digitalizado ou layout diferente.',
  },
  SEM_USUARIO: {
    label: 'Sem login',
    chip: 'warning',
    icon: 'pi-bell-slash',
    ajuda: 'O holerite será enviado, mas a pessoa não tem login e não receberá o aviso.',
  },
};

/** O que a API respondeu depois de gravar. */
export interface VincularHoleriteResult {
  totalPaginas: number;
  vinculados: number;
  naoEncontrados: string[];
  jaExistiam: string[];
}

/** Holerite do próprio funcionário, na tela de auto-atendimento. */
export interface Holerite {
  id: string;
  competencia: string;
  tipo: HoleriteTipo;
  originalFilename: string;
  createdAt: string;
  openedAt?: string | null;
  confirmedAt?: string | null;
}

/**
 * Uma linha da auditoria do RH.
 *
 * `temUsuario` responde "essa pessoa consegue ser avisada?". Sem ele a tela
 * mostraria "nunca abriu" para quem nunca foi notificado, e o RH cobraria a
 * pessoa errada.
 */
export interface HoleriteAuditoria {
  id: string;
  employeeId: string;
  employeeNome: string;
  codParceiro: string;
  competencia: string;
  tipo: HoleriteTipo;
  originalFilename: string;
  createdAt: string;
  openedAt: string | null;
  confirmedAt: string | null;
  canceledAt: string | null;
  canceledBy: string | null;
  cancelReason: string | null;
  replacedAt: string | null;
  temUsuario: boolean;
}

/** A situação de uma linha, derivada das datas — a tela não repete essa regra. */
export type AuditoriaSituacao = 'CANCELADO' | 'CONFIRMADO' | 'ABERTO' | 'ENTREGUE' | 'SEM_AVISO';

export function situacaoDe(item: HoleriteAuditoria): AuditoriaSituacao {
  if (item.canceledAt) return 'CANCELADO';
  if (item.confirmedAt) return 'CONFIRMADO';
  if (item.openedAt) return 'ABERTO';
  // Sem login não há como avisar: "nunca abriu" aqui é a nossa falha, não dela.
  return item.temUsuario ? 'ENTREGUE' : 'SEM_AVISO';
}

export const AUDITORIA_SITUACAO_INFO: Record<AuditoriaSituacao, {
  label: string;
  chip: 'active' | 'warning' | 'danger' | 'neutral';
  icon: string;
}> = {
  CONFIRMADO: { label: 'Confirmado', chip: 'active',  icon: 'pi-verified' },
  ABERTO:     { label: 'Abriu',      chip: 'active',  icon: 'pi-eye' },
  ENTREGUE:   { label: 'Não abriu',  chip: 'warning', icon: 'pi-clock' },
  SEM_AVISO:  { label: 'Sem login',  chip: 'warning', icon: 'pi-bell-slash' },
  CANCELADO:  { label: 'Cancelado',  chip: 'danger',  icon: 'pi-ban' },
};

// ─── Separação em PDFs (a outra ferramenta, que não vincula nada) ────────────

export interface PdfPageInfo {
  name: string;
}

export interface PdfUploadResponse {
  uploadId: string;
  pages: PdfPageInfo[];
}
