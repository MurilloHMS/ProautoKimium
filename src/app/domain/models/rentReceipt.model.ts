export interface MatrizPreviewDTO{
  codMatriz: string;
  nomeMatriz: string;
  totalUnidades: number;
  totalMaquinas: number;
  totalMatriz: number;
  dataVencimento?: Date | null;
}

export interface ReportPreviewDTO{
  processId: string;
  matrizes: MatrizPreviewDTO[];
}
