/**
 * O vocabulário das telas de configuração de permissão.
 *
 * O que a API chama de `cells` é sempre o mesmo formato do
 * `GET api/me/permissions`: tela apontando para as ações ligadas. **Ausente é
 * negado** — a grade viaja completa, e não em pedaços.
 */

/** `{ 'stock/movements': ['CONSULTAR', 'EXCLUIR'] }` */
export type PermissionCells = Record<string, string[]>;

/**
 * As sete, na ordem do enum da API.
 *
 * Esta ordem é a das colunas do grid. Reordenar "para ficar alfabético" muda a
 * tela e desalinha a leitura de quem já decorou onde fica o Excluir.
 */
export const PERMISSIONS = [
  'ALTERAR', 'EXCLUIR', 'CONSULTAR', 'CONFIGURAR', 'INCLUIR', 'ENVIAR', 'BAIXAR',
] as const;

export type PermissionName = typeof PERMISSIONS[number];

/**
 * O nome de cada ação, por extenso.
 *
 * Eram abreviações ("Cons", "Conf") porque a grade tinha sete colunas de 62px.
 * Sem colunas, cada tela mostra só as ações que usa, e cabe a palavra inteira.
 * CONSULTAR vira "Ver": é o que a pessoa faz com a tela, e é a única ação de
 * metade delas.
 */
export const PERMISSION_LABELS: Record<PermissionName, string> = {
  ALTERAR: 'Alterar',
  EXCLUIR: 'Excluir',
  CONSULTAR: 'Ver',
  CONFIGURAR: 'Configurar',
  INCLUIR: 'Incluir',
  ENVIAR: 'Enviar',
  BAIXAR: 'Baixar',
};

export interface ScreenRow {
  code: string;
  label: string;
  module: string;
  sortOrder: number;
  /**
   * As ações que esta tela usa de verdade, na ordem de `PERMISSIONS`.
   *
   * A API as lê dos próprios `@PreAuthorize`, então endpoint novo já nasce na
   * grade. Tela que nenhum endpoint cita vem com `['CONSULTAR']`.
   */
  actions: PermissionName[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  allowedCells: number;
  appliedToUsers: number;
}

export interface TemplateGrid {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  cells: PermissionCells;
}

export interface UserSummary {
  id: string;
  name: string;
  login: string;
  active: boolean;
  /**
   * Conta de desenvolvedor: tem tudo por resolução, e a grade dela não se
   * edita. É a saída de emergência do controle de acesso — o que garante que
   * sempre exista alguém capaz de reabrir o sistema.
   */
  developer: boolean;
  templates: string[];
}

export interface AppliedTemplate {
  id: string;
  name: string;
  appliedAt: string;
  appliedBy: string | null;
  mode: ApplyMode;
}

export interface UserGrid {
  id: string;
  name: string;
  login: string;
  developer: boolean;
  cells: PermissionCells;
  /**
   * O que os modelos aplicados nesta pessoa permitem.
   *
   * A diferença para `cells` é o ponto âmbar da tela. É derivado no servidor a
   * partir de `user_templates`, e por isso **não distingue** a célula que
   * alguém ajustou da célula que divergiu porque o modelo mudou depois — daí o
   * rótulo ser "difere dos modelos aplicados".
   */
  appliedCells: PermissionCells;
  appliedTemplates: AppliedTemplate[];
}

/**
 * SOMAR liga o que o modelo permite e não desliga nada; SUBSTITUIR grava o
 * modelo exato.
 *
 * É a única escolha desta feature que apaga trabalho de alguém, e por isso a
 * tela escreve as duas consequências antes do clique.
 */
export type ApplyMode = 'SOMAR' | 'SUBSTITUIR';

/**
 * Uma pessoa que acessa uma tela, e de onde vem cada ação: os modelos que dão,
 * o que foi liberado sem modelo nenhum dar, e o que um modelo dá e alguém tirou.
 */
export interface ScreenAccessPerson {
  id: string;
  name: string;
  login: string;
  active: boolean;
  actions: PermissionName[];
  templates: string[];
  addedByHand: PermissionName[];
  removedByHand: PermissionName[];
}

export interface ScreenAccess {
  screen: string;
  people: ScreenAccessPerson[];
}

/** Quem acessa cada tela. Desenvolvedores têm tudo e só entram na contagem. */
export interface ScreenAccessOverview {
  developers: number;
  screens: ScreenAccess[];
}

/** O que o "Reaplicar" faria com uma pessoa. As chaves vêm como `tela:AÇÃO`. */
export interface ReapplyPerson {
  id: string;
  name: string;
  /** Ajuste à mão que se perde. */
  loses: string[];
  /** O que a versão nova do modelo passou a dar. */
  gains: string[];
}

export interface ReapplyPreview {
  people: ReapplyPerson[];
}

export interface ApplyResult {
  users: number;
  cellsChanged: number;
}
