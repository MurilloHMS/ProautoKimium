/**
 * A prévia da newsletter: o que o ERP devolveu, antes de virar fila de envio.
 *
 * O fluxo antigo passava por planilha — consulta à mão, exporta Excel, sobe no
 * sistema. Aqui a API busca no Sankhya, e esta tela é onde os números são
 * conferidos antes de qualquer e-mail sair.
 */
export interface PreviaNewsletter {
  id: string;
  mes: number;
  ano: number;
  /** Vem da API, não do navegador: o ERP já responde "Junho" em português. */
  nomeDoMes: string;
  clientes: ClienteDaNewsletter[];
  pendencias: PendenciaDeHora[];
}

export interface ClienteDaNewsletter {
  /**
   * Texto, e não número: é assim que a coluna existe no banco (`VARCHAR(50)`),
   * e é assim que a API responde. Declarar `number` aqui faria o `===` de
   * `substituirCliente` comparar tipos diferentes e nunca casar.
   */
  codigoCliente: string;
  nomeDoCliente: string;
  /**
   * Pode vir vazio: 31 dos 913 clientes de junho não têm e-mail no cadastro do
   * ERP. Ele é preenchido aqui, e vale **só para este mês** — decisão dele de
   * guardar na própria newsletter em vez de numa tabela de complementos.
   */
  emailCliente: string | null;
  /** Quem pediu para não receber fica na lista, marcado, e fora do envio. */
  recebeEmail: boolean;

  codigoMatriz: string | null;
  nomeMatriz: string | null;

  quantidadeNotasEmitidas: number;
  quantidadeDeProdutos: number;
  quantidadeDeLitros: number;
  quantidadeDeVisitas: number;
  mediaDiasAtendimento: number;
  produtoEmDestaque: string;

  faturamentoTotal: number;
  valorDePecasTrocadas: number;
  valorTotalDeHoras: number;
  valorTotalCobradoHoras: number;
  mauUso: boolean;
  valorTotalDeHorasMauUso: number;
  valorTotalCobradoHorasMauUso: number;
}

/**
 * Uma ordem de serviço cuja hora não deu para ler.
 *
 * O campo é texto livre no Sankhya e vem em duas convenções — `13:00` e
 * `14h20`. O que não cai em nenhuma delas chega aqui com o **texto original**,
 * que é o que permite decidir: `"5:00 horas"` tanto pode ser cinco da manhã
 * quanto cinco horas de trabalho, e só quem escreveu sabe.
 *
 * Antes desta tela essas OS sumiam em silêncio — 82 das 350 em junho.
 */
export interface PendenciaDeHora {
  numeroOs: number;
  codigoCliente: string;
  nomeDoCliente: string;
  /** Como está no ERP; `null` quando o campo veio vazio. */
  horaInicio: string | null;
  horaFim: string | null;
}

/** O que a tela manda ao corrigir uma OS. */
export interface CorrecaoDeHora {
  horaInicio: string;
  horaFim: string;
}

/** Um e-mail preenchido à mão para um cliente que não tem no cadastro. */
export interface EmailPreenchido {
  codigoCliente: string;
  email: string;
}

export function semEmail(cliente: ClienteDaNewsletter): boolean {
  return !cliente.emailCliente || !cliente.emailCliente.trim();
}

/**
 * A prévia do mês que já foi confirmado é recusada pela API — a newsletter
 * dispara e-mail, e refazer um mês é o tipo de coisa que se descobre tarde.
 * A tela mostra **o que a API disse**, e não "erro 409".
 */
export interface MesJaConfirmado {
  confirmadoEm: string;
  quantidadeDeClientes: number;
}
