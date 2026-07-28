export interface UnidadePreviewDTO {
  numNota: string;
  nomeParceiro: string;
  documento: string;
  enderecoEntrega: string;
  quantidadeMaquinas: number;
  vlrDesdobramento: number;
}

export interface MatrizPreviewDTO {
  codMatriz: string;
  nomeMatriz: string;
  totalUnidades: number;
  totalMaquinas: number;
  totalMatriz: number;
  unidades: UnidadePreviewDTO[];
  dataVencimento?: Date | null;
}

export interface ReportPreviewDTO {
  processId: string;
  matrizes: MatrizPreviewDTO[];
}

export type GenerationMode = 'MATRIZ' | 'UNIDADE';

export interface ReceiptRow {
  id: string;
  type: GenerationMode;
  code: string;
  name: string;
  originalName: string;
  totalMaquinas: number;
  totalAmount: number;
  dataVencimento: Date | null;
  selected: boolean;
  editingName: boolean;
  editingDate: boolean;
  codMatriz: string;
  parentMatrizName?: string;
}

export interface GenerateRequestV2 {
  processId: string;
  mesReferencia: string;
  anoReferencia: number;
  mode: GenerationMode;
  vencimentos: Record<string, string>;
  nomeOverrides: Record<string, string>;
  excludedKeys: string[];
}

export interface ReceiptBatchSummary {
  id: string;
  referenceMonth: string;
  referenceYear: number;
  generatedAt: string;
  totalAmount: number;
  receiptCount: number;
  sourceFilename: string;
}

export interface ReceiptDetail {
  id: string;
  receiptType: string;
  codMatriz: string;
  nomeMatriz: string;
  nomeParceiro: string;
  dueDate: string;
  totalAmount: number;
  originalFilename: string;
}

export interface ReceiptBatchDetail {
  batch: ReceiptBatchSummary;
  receipts: ReceiptDetail[];
}
