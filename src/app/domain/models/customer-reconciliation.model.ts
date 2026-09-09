/**
 * A conciliação do cadastro de clientes com o Sankhya.
 *
 * O ERP e o KimiumHub são a mesma lista mantida duas vezes. Isto mostra onde
 * elas discordam, para a pessoa decidir linha a linha — e nada é gravado sem
 * que ela marque.
 */
export interface Reconciliation {
  /** Estão no ERP e não aqui. */
  toCreate: ReconciliationRow[];
  /** Estão nos dois, com pelo menos um campo diferente. */
  toUpdate: ReconciliationRow[];
  /** Ativos aqui e inativos no ERP. Nada é apagado. */
  toDeactivate: ReconciliationRow[];
  /**
   * Quantos já estão iguais — **contagem, não lista**. Foram 1734 contra 61 na
   * medição: listá-los esconderia os que mudaram.
   */
  unchanged: number;
}

export interface ReconciliationRow {
  code: string;
  name: string;
  document: string | null;
  email: string | null;
  matrizCode: string | null;
  active: boolean;
  /**
   * O que o servidor viu quando montou esta linha. Volta no aplicar: se o ERP
   * mudou desde então, a linha é recusada em vez de gravar algo que ninguém viu.
   */
  signature: string;
  differences: FieldDiff[];
  /** Vazio quando a linha pode ser aplicada. */
  impediments: Impediment[];
}

export interface FieldDiff {
  field: string;
  localValue: string | null;
  erpValue: string | null;
}

export interface Impediment {
  reason: ImpedimentReason;
  detail: string;
}

export type ImpedimentReason =
  | 'EMAIL_INVALID'
  | 'CODE_BELONGS_TO_EMPLOYEE'
  | 'CNPJ_FROM_OTHER_CLIENT'
  | 'NO_CODE';

export interface ReconciliationChoice {
  code: string;
  signature: string;
}

export interface ReconciliationResult {
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  /** Só as que não deram no esperado. As que funcionaram não viram linha. */
  lines: ReconciliationOutcome[];
}

export interface ReconciliationOutcome {
  code: string;
  name: string | null;
  outcome: string;
  detail: string;
}

/** Rótulo dos campos, para a tela não mostrar o nome da coluna. */
export const FIELD_LABEL: Record<string, string> = {
  nome: 'Nome',
  documento: 'Documento',
  email: 'E-mail',
  codigoMatriz: 'Grupo',
};

/** A linha pode ser marcada? Impedimento trava a linha inteira. */
export function canApply(row: ReconciliationRow): boolean {
  return row.impediments.length === 0;
}

/**
 * Mudança de grupo não é um campo como os outros: ela muda **quem enxerga o
 * quê** no portal do cliente, e o caminho de volta tira acesso de alguém.
 */
export function isGroupChange(diff: FieldDiff): boolean {
  return diff.field === 'codigoMatriz';
}
