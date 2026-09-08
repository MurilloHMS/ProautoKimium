// ═══════════════════════════════════════════════════════════════════════════
// O resultado do Sankhya, traduzido
//
// O ERP devolve as colunas numa lista e os valores noutra, na mesma ordem:
//
//   {"fieldsMetadata":[{"name":"CODPROD"},{"name":"CMV"}],
//    "rows":[[1075, 5348.57]]}
//
// Não são objetos com chave — é matriz. Casar as duas listas pelo índice é o
// que transforma QUALQUER consulta em algo que a tela lê, e é a consequência
// direta de a API repassar a resposta como veio, sem inventar DTO.
//
// Fica aqui, e não na tela, porque vale para toda consulta.
// ═══════════════════════════════════════════════════════════════════════════

/** Uma coluna, como o Sankhya a descreve. */
export interface ColunaSankhya {
  name: string;
  order?: number;
  /** Tipo do ERP: `I` inteiro, `F` decimal, `S` texto, `D` data. */
  userType?: string;
}

export interface ResultadoSankhya {
  fieldsMetadata: ColunaSankhya[];
  rows: unknown[][];
  /** `true` quando o ERP cortou o resultado — ver o aviso na tela. */
  burstLimit?: boolean;
}

/** Uma linha já com nome de coluna. */
export type LinhaSankhya = Record<string, unknown>;

/**
 * Converte `fieldsMetadata` + `rows` em objetos.
 *
 * `Map` preservando a ordem das colunas de propósito: com `HashMap` do outro
 * lado o JSON sairia embaralhado, e quem lê acharia que a consulta mudou.
 *
 * Valor que falta na linha vira `null` em vez de sumir — a coluna existir é o
 * que deixa a tela distinguir "não veio" de "veio vazio".
 */
export function emLinhas(resultado: ResultadoSankhya): LinhaSankhya[] {
  const colunas = resultado?.fieldsMetadata;
  const linhas = resultado?.rows;

  if (!colunas?.length || !linhas?.length) return [];

  return linhas.map(valores => {
    const registro: LinhaSankhya = {};

    colunas.forEach((coluna, i) => {
      registro[coluna.name] = i < valores.length ? valores[i] : null;
    });

    return registro;
  });
}
