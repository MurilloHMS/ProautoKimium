/**
 * A situação de um documento, calculada pela API (`statusOn`) e nunca aqui:
 * a regra mora num lugar só. A tela só traduz para rótulo, cor e ícone.
 */
export type EmployeeDocumentStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_DUE_DATE' | 'REPLACED';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  employeeName: string;
  typeId: string | null;
  typeName: string | null;
  title: string;
  originalFilename: string;
  contentType: string | null;
  sizeBytes: number | null;
  /** `yyyy-MM-dd`, ou nulo quando o documento não vence. */
  dueDate: string | null;
  status: EmployeeDocumentStatus;
  /** Negativo já venceu, zero vence hoje; nulo sem vencimento. */
  daysUntilDue: number | null;
  replacedById: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
}

export interface EmployeeDocumentUpdate {
  title: string;
  typeId: string | null;
  dueDate: string | null;
}

export interface EmployeeDocumentType {
  id: string;
  name: string;
  /** Do maior para o menor, a ordem em que os avisos chegam. */
  alertDaysBefore: number[];
  notifyOnExpiry: boolean;
  recipientEmployeeIds: string[];
  active: boolean;
}

export type EmployeeDocumentTypeRequest = Omit<EmployeeDocumentType, 'id'>;

/**
 * Rótulo, papel de cor e ícone de cada situação — o mesmo vocabulário do
 * `.status-chip` (styles/chips.scss): o ícone é o que sobrevive à escala de
 * cinza. `chip` é o plural do filtro ("Vencidos"), `label` o singular do selo.
 */
export const DOCUMENT_STATUS_INFO: Record<EmployeeDocumentStatus, {
  label: string; chip: string; severity: 'success' | 'warning' | 'danger' | 'neutral'; icon: string;
}> = {
  EXPIRED:     { label: 'Vencido',        chip: 'Vencidos',       severity: 'danger',  icon: 'pi pi-exclamation-triangle' },
  EXPIRING:    { label: 'Vence em breve', chip: 'Vence em breve', severity: 'warning', icon: 'pi pi-clock' },
  VALID:       { label: 'Válido',         chip: 'Válidos',        severity: 'success', icon: 'pi pi-check-circle' },
  NO_DUE_DATE: { label: 'Sem vencimento', chip: 'Sem vencimento', severity: 'neutral', icon: 'pi pi-minus-circle' },
  REPLACED:    { label: 'Substituído',    chip: 'Substituídos',   severity: 'neutral', icon: 'pi pi-history' },
};

/** A ordem dos chips: o que precisa de alguém primeiro. */
export const DOCUMENT_STATUS_ORDER: EmployeeDocumentStatus[] = ['EXPIRED', 'EXPIRING', 'VALID', 'NO_DUE_DATE', 'REPLACED'];

/**
 * A distância até o vencimento, dita como se pergunta à tela: "quanto falta?".
 * Substituído não tem prazo — a data dele é história.
 */
export function describeDue(document: Pick<EmployeeDocument, 'status' | 'daysUntilDue'>): string {
  if (document.status === 'REPLACED') return 'substituído';
  const days = document.daysUntilDue;
  if (days === null) return 'sem vencimento';
  if (days < 0) return `vencido há ${-days} d`;
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  return `vence em ${days} dias`;
}
