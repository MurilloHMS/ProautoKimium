/**
 * Um parceiro do Sankhya, buscado pelo CODPARC para preencher o cadastro de
 * funcionário.
 *
 * O ERP sabe nome, documento e e-mail. Empresa, setor, cargo, nível, tipo de
 * contrato e data de admissão continuam sendo de quem cadastra.
 */
export type PartnerConflict = 'ALREADY_A_CUSTOMER' | 'ALREADY_AN_EMPLOYEE';

export interface ErpPartner {
  codParceiro: string;
  name: string;
  document: string;
  /**
   * Pode vir nulo, e isso é legítimo: muitos funcionários não têm e-mail no
   * ERP — é por isso que o primeiro acesso é por CPF. Vem nulo também quando o
   * e-mail do ERP não passa na validação, para o campo não nascer inválido.
   */
  email: string | null;
  activeInErp: boolean;
  /** Nulo quando o código está livre. */
  conflict: PartnerConflict | null;
  /** Nome de quem já usa o código, para o aviso dizer de quem se trata. */
  conflictWith: string | null;
}
