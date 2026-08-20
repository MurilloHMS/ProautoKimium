/**
 * Holerites — espelha os DTOs da API.
 *
 * Estavam declarados dentro dos componentes, cada tela com a sua cópia. Com
 * três telas lendo o mesmo endpoint, a cópia que ficava para trás era a que
 * quebrava.
 */

export type HoleriteTipo =
  | 'SALARIO'
  | 'ADIANTAMENTO'
  | 'DECIMO_TERCEIRO_1'
  | 'DECIMO_TERCEIRO_2';

/**
 * Os tipos na ordem em que aparecem para escolher, com o rótulo curto do botão
 * e o completo do resto.
 *
 * Uma lista só: o seletor do envio, o filtro do funcionário e o texto da
 * confirmação leem daqui. Antes eram três lugares com o mesmo ternário, e o do
 * aviso de notificação já chamava qualquer coisa de "salário".
 *
 * O mês de cada parcela do 13º não está aqui de propósito — quem diz o mês é a
 * competência escolhida no envio. Fixar novembro e dezembro no código quebraria
 * no ano em que o RH pagar as duas juntas.
 */
export const HOLERITE_TIPOS: ReadonlyArray<{
  value: HoleriteTipo;
  label: string;
  curto: string;
  icon: string;
}> = [
  { value: 'SALARIO',           label: 'Salário',          curto: 'Salário',      icon: 'pi pi-wallet' },
  { value: 'ADIANTAMENTO',      label: 'Adiantamento',     curto: 'Adiantamento', icon: 'pi pi-calendar' },
  { value: 'DECIMO_TERCEIRO_1', label: '13º — 1ª parcela', curto: '13º · 1ª',     icon: 'pi pi-gift' },
  { value: 'DECIMO_TERCEIRO_2', label: '13º — 2ª parcela', curto: '13º · 2ª',     icon: 'pi pi-gift' },
];

export const HOLERITE_TIPO_LABEL: Record<HoleriteTipo, string> =
  Object.fromEntries(HOLERITE_TIPOS.map(t => [t.value, t.label])) as Record<HoleriteTipo, string>;

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
}

// ─── Separação em PDFs (a outra ferramenta, que não vincula nada) ────────────

export interface PdfPageInfo {
  name: string;
}

export interface PdfUploadResponse {
  uploadId: string;
  pages: PdfPageInfo[];
}
