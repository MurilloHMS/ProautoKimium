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

/** O rótulo curto de cada coluna. O nome inteiro não cabe em 62px. */
export const PERMISSION_LABELS: Record<PermissionName, string> = {
  ALTERAR: 'Alt',
  EXCLUIR: 'Exc',
  CONSULTAR: 'Cons',
  CONFIGURAR: 'Conf',
  INCLUIR: 'Inc',
  ENVIAR: 'Env',
  BAIXAR: 'Baix',
};

export interface ScreenRow {
  code: string;
  label: string;
  module: string;
  sortOrder: number;
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

export interface ApplyResult {
  users: number;
  cellsChanged: number;
}
