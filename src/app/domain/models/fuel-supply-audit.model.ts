/**
 * A conferência da planilha de abastecimentos.
 *
 * A importação virou dois passos na API: `POST /fuelsupply/preview` lê o
 * arquivo e devolve o diagnóstico sem gravar nada, e `POST /fuelsupply/import`
 * grava o que a tela devolveu. O `/upload`, que lia e gravava na mesma
 * requisição, não existe mais.
 *
 * Os nomes dos campos saem dos records da API. Traduzir aqui faria o valor
 * chegar vazio.
 */

/** Uma linha lida da planilha, já diagnosticada e ainda não gravada. */
export interface FuelSupplyPreviewRow {
  /** A linha como o Excel numera, para a pessoa achar no arquivo dela. */
  linha: number;
  driverName: string | null;
  fuelSupplyDate: string;
  uf: string | null;
  plate: string | null;
  actualHodometer: number;
  fuelType: string | null;
  liters: number;
  totalValue: number;
  price: number;
  diferenceHodometer: number;
  averageKm: number;
  /** Sugerido pelo setor do motorista — `null` quando ele não foi encontrado. */
  departmentId: string | null;
  departmentName: string | null;
  motoristaEncontrado: boolean;
  /** Mesmo motorista, mesma data e mesmo valor já estão no banco. */
  jaExiste: boolean;
}

/**
 * A linha na tela: o que veio da API mais o que a conferência decide.
 *
 * `selecionada` mora aqui e não na API porque é decisão de quem confere. As
 * duplicatas nascem desmarcadas; o resto, marcado.
 */
export interface LinhaDeConferencia extends FuelSupplyPreviewRow {
  selecionada: boolean;
}

/** Uma linha aprovada, do jeito que a API espera de volta. */
export interface FuelSupplyImportRow {
  linha: number;
  fuelSupplyDate: string;
  uf: string | null;
  plate: string | null;
  driverName: string | null;
  departmentId: string | null;
  actualHodometer: number;
  diferenceHodometer: number;
  averageKm: number;
  fuelType: string | null;
  liters: number;
  price: number;
  totalValue: number;
}

/**
 * O que a gravação fez.
 *
 * É tudo ou nada: uma linha recusada cancela a remessa, `gravadas` vem zero e
 * a API responde 422 com os motivos.
 */
export interface FuelSupplyImportResult {
  gravadas: number;
  recusadas: number;
  motivos: string[];
}

/** Opção do combo de departamento da conferência. */
export interface DepartmentOption {
  id: string;
  name: string;
}

/** Os recortes da conferência — cada um é um chip acima da tabela. */
export type FiltroDeConferencia = 'tudo' | 'atencao' | 'sem-motorista' | 'duplicadas';
