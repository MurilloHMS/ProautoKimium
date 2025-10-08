export interface Newsletter {
  id?: number;
  codigoCliente: string;
  nomeDoCliente: string;
  data: string;
  mes: string;
  quantidadeDeProdutos: number;
  quantidadeDeLitros: number;
  quantidadeDeVisitas: number;
  quantidadeNotasEmitidas: number;
  mediaDiasAtendimento: number;
  produtoEmDestaque: string;
  faturamentoTotal: number;
  valorDePecasTrocadas: number;
  status: string;
  emailCliente: string;
}

export interface NewsletterResponse {
  newsletters: Newsletter[];
  total: number;
  message?: string;
}
