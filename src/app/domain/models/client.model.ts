/**
 * Contratos da Área do Cliente (`/api/client/**`).
 *
 * Os nomes seguem os records da API — `ClientMeDTO`, `ClientUnitDTO` e
 * `NewsletterResponseDTO`. Renomear aqui faz o campo chegar vazio.
 */

/** Uma unidade que o login enxerga. Para quem não é matriz, é só a própria. */
export interface ClientUnit {
  codParceiro: string;
  nome: string;
  documento: string;
  matriz: boolean;
}

/**
 * Quem está logado, buscado a cada carga.
 *
 * Não sai do token de propósito: o JWT vale duas horas e não acompanha
 * mudança de cadastro — cliente desativado no meio da sessão continuaria
 * entrando até o token expirar.
 */
export interface ClientMe {
  nome: string;
  codParceiro: string;
  documento: string;
  matriz: boolean;
  unidades: ClientUnit[];
}

/**
 * Um informativo mensal de uma unidade — a newsletter que o cliente recebe por
 * e-mail, em forma de dado.
 *
 * `valorTotalDeHoras` é quantidade de horas; `valorTotalCobradoHoras` é o que
 * foi cobrado por elas. Os nomes vêm da planilha e enganam.
 *
 * `valorPecasTrocadas` é o valor das manutenções realizadas, **cobradas ou
 * não** — inclui peça trocada em garantia. Não é uma cobrança.
 */
export interface ClientNewsletter {
  codigoCliente: string;
  nomeCliente: string;
  data: string;
  mes: string;
  quantidadeProdutos: number;
  quantidadeLitros: number;
  quantidadeNotasEmitidas: number;
  quantidadeDeVisitas: number;
  mediaDiasAtendimento: number;
  produtoDestaque: string;
  faturamentoTotal: number;
  valorPecasTrocadas: number;
  valorTotalDeHoras: number;
  valorTotalCobradoHoras: number;
  mauUso: boolean;
  valorTotalDeHorasMauUso: number;
  valorTotalCobradoHorasMauUso: number;
  status: string;
  email: string;
  codigoMatriz: string;
  nomeMatriz: string;
}
