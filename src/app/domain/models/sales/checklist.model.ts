/**
 * O checklist de vendas — o mesmo formato que a API grava em `payload` (jsonb)
 * e que o celular guarda no IndexedDB enquanto não envia.
 *
 * Os textos de lista fechada (tipo de máquina, tipo de pedido) viajam como
 * texto, igual na API: um valor desconhecido vira frase na validação, e não
 * erro de leitura.
 */

export interface ChecklistAddress {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

export interface ChecklistCustomer {
  /** CODPARC do Sankhya; nulo para cliente novo. */
  code: number | null;
  newCustomer: boolean;
  name: string | null;
  legalName: string | null;
  document: string | null;
  stateRegistration: string | null;
  mainPhone: string | null;
  mobile: string | null;
  signatory: string | null;
  signatoryCpf: string | null;
  invoiceEmail: string | null;
  contractEmail: string | null;
  priceTable: number | null;
  /**
   * O que o Sankhya tinha em cada campo quando o vendedor escolheu o cliente.
   * É com isso que a Controladoria vê "Sankhya: X → checklist: Y".
   */
  erp: Record<string, string> | null;
}

export type MachineType = 'CAPO' | 'ESTEIRA' | 'FRONTAL' | 'OUTRA';
export type OrderKind = 'VENDA' | 'BONIFICADO';
export type PriceSource = 'CLIENTE' | 'GERAL';

/** "Vai com mesa?" é só Sim ou Não: o tipo da mesa saiu a pedido dele (2026-09-30). */
export interface ChecklistMachine {
  type: MachineType | null;
  otherType: string | null;
  quantity: number;
  withTable: boolean | null;
}

export interface ChecklistComodatoItem {
  productCode: number;
  name: string;
  popularName: string | null;
  quantity: number;
}

export interface ChecklistExtraItem {
  description: string;
  quantity: number;
}

export interface ChecklistVisualItem {
  itemId: string | null;
  name: string;
  quantity: number;
}

export interface ChecklistUsedProduct {
  productCode: number;
  name: string;
  equipmentLabel: boolean;
  bottleLabel: boolean;
  dilution: string | null;
}

/**
 * Uma linha do pedido. O preço é por `unit` (KG, LT), como a tabela do
 * Sankhya; a quantidade é em embalagens (`packages` × `packageSize`).
 */
export interface ChecklistOrderItem {
  productCode: number;
  name: string;
  unit: string | null;
  packageSize: number | null;
  packageLabel: string | null;
  packages: number;
  unitPrice: number | null;
  ipiPercent: number | null;
  priceTable: number | null;
  priceSource: PriceSource;
  lineTotal: number | null;
}

export interface ChecklistContent {
  customer: ChecklistCustomer | null;
  mainAddress: ChecklistAddress | null;
  deliverySameAsMain: boolean | null;
  deliveryAddress: ChecklistAddress | null;
  unitContact: { name: string | null; receivingHours: string | null; phone: string | null } | null;
  installation: {
    withMaintenance: boolean | null;
    needsMachine: boolean | null;
    machines: ChecklistMachine[];
    notes: string | null;
  } | null;
  comodato: { items: ChecklistComodatoItem[]; extraItems: ChecklistExtraItem[]; notes: string | null } | null;
  visual: {
    items: ChecklistVisualItem[];
    products: ChecklistUsedProduct[];
    technicalDocs: boolean | null;
    technicalDocsEmail: string | null;
  } | null;
  order: { enabled: boolean; kind: OrderKind | null; items: ChecklistOrderItem[]; total: number | null } | null;
}

// ─── Situação ───────────────────────────────────────────────────────────────

export type ChecklistStatus = 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'CHANGE_REQUESTED' | 'REOPENED';

export type ChecklistEventType =
  | 'SUBMITTED' | 'RESUBMITTED' | 'APPROVED' | 'RETURNED'
  | 'CHANGE_REQUESTED' | 'CHANGE_GRANTED' | 'CHANGE_DENIED';

/** Palavras do dia a dia, e o papel de cor do selo (os mesmos tokens do `.status-chip`). */
export const CHECKLIST_STATUS: Record<ChecklistStatus, { label: string; tone: 'warning' | 'success' | 'danger' | 'info' | 'neutral' }> = {
  SUBMITTED:        { label: 'Aguardando análise',     tone: 'warning' },
  APPROVED:         { label: 'Aprovado',               tone: 'success' },
  RETURNED:         { label: 'Devolvido para corrigir', tone: 'danger' },
  CHANGE_REQUESTED: { label: 'Alteração pedida',       tone: 'info' },
  REOPENED:         { label: 'Liberado para alterar', tone: 'info' },
};

export const CHECKLIST_EVENT: Record<ChecklistEventType, string> = {
  SUBMITTED: 'Enviado',
  RESUBMITTED: 'Reenviado',
  APPROVED: 'Aprovado',
  RETURNED: 'Devolvido',
  CHANGE_REQUESTED: 'Pedido de alteração',
  CHANGE_GRANTED: 'Alteração liberada',
  CHANGE_DENIED: 'Alteração negada',
};

/** Só devolvido e liberado aceitam edição. */
export function editavel(status: ChecklistStatus): boolean {
  return status === 'RETURNED' || status === 'REOPENED';
}

export interface ChecklistSummary {
  id: string;
  number: number | null;
  sellerLogin: string;
  sellerName: string;
  customerCode: number | null;
  customerName: string;
  customerDocument: string;
  newCustomer: boolean;
  status: ChecklistStatus;
  version: number;
  hasOrder: boolean;
  orderTotal: number | null;
  filledOffline: boolean;
  firstSubmittedAt: string;
  lastSubmittedAt: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  changeReason: string | null;
  changeRequestedAt: string | null;
}

export interface ChecklistDetail {
  summary: ChecklistSummary;
  content: ChecklistContent;
  events: { type: ChecklistEventType; version: number; actorLogin: string; actorName: string; notes: string | null; createdAt: string }[];
  changes: { version: number; field: string; before: string | null; after: string | null; changedBy: string; changedAt: string }[];
  erpDifferences: { field: string; erp: string | null; checklist: string | null }[];
}

export interface ChecklistSubmit {
  revision: number;
  content: ChecklistContent;
  filledOffline: boolean;
  deviceStartedAt: string | null;
}

// ─── Catálogo (o que fica no celular) ───────────────────────────────────────

export interface CatalogCustomer {
  code: number;
  name: string;
  legalName: string | null;
  document: string | null;
  personType: string | null;
  stateRegistration: string | null;
  phone: string | null;
  invoiceEmail: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  priceTable: number | null;
}

export interface CatalogProduct {
  code: number;
  name: string;
  usage: string | null;
  group: number;
  unit: string | null;
  ipi: number | null;
  packageLabel: string | null;
  packageSize: number | null;
  packageFromName: boolean;
}

export interface CatalogPrice {
  table: number;
  product: number;
  price: number;
}

export interface ChecklistCatalog {
  version: string;
  erpFetchedAt: string | null;
  customers: CatalogCustomer[];
  products: CatalogProduct[];
  prices: CatalogPrice[];
  comodato: { id: string; productCode: number; name: string; popularName: string | null; active: boolean }[];
  visualItems: { id: string; name: string }[];
}

// ─── Cadastros da Controladoria ─────────────────────────────────────────────

export interface RegisterVisualItem { id: string; name: string; sortOrder: number; active: boolean; }
export interface RegisterComodatoItem { id: string; productCode: number; erpName: string | null; popularName: string | null; sortOrder: number; active: boolean; }
export interface ComodatoCandidate { productCode: number; name: string; group: number; chosen: boolean; }

/** A tabela geral: vale para quem não tem tabela e para cliente novo. */
export const TABELA_GERAL = 80;
