export interface Newsletter {
  codigoCliente: string;
  nomeDoCliente: string;
  data: Date;
  mes: string;
  quantidadeProdutos: number;
  quantidadeLitros: number;
  quantidadeNotasEmitidas: number;
  mediaDiasAtendimento: number;
  produtoDestaque: string;
  faturamentoTotal: number;
  valorPecasTrocadas: number;
  status: string;
  email: string;
}

export interface NewsletterResponse {
  newsletters: Newsletter[];
  total: number;
  message?: string;
}
