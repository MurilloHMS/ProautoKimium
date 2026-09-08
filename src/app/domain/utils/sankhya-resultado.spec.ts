import { emLinhas, type ResultadoSankhya } from './sankhya-resultado';

/**
 * **O Sankhya devolve colunas de um lado e valores do outro.**
 *
 * ```json
 * {"fieldsMetadata":[{"name":"CODPROD"},{"name":"CMV"}], "rows":[[1075, 5348.57]]}
 * ```
 *
 * Não são objetos com chave: é uma matriz, e o nome da coluna está noutra
 * lista, na mesma ordem. Casar as duas pelo índice é o que transforma qualquer
 * consulta em algo que a tela consegue ler — e é a consequência direta de a API
 * repassar a resposta como veio, sem inventar DTO.
 *
 * Por isso este arquivo existe separado da tela: a tradução vale para toda
 * consulta, não só para a de produtos.
 */
describe('emLinhas — o resultado do Sankhya vira objetos', () => {

  const resultado = (colunas: string[], linhas: unknown[][]): ResultadoSankhya => ({
    fieldsMetadata: colunas.map((name, i) => ({ name, order: i + 1 })),
    rows: linhas,
  });

  it('casa cada valor com o nome da sua coluna', () => {
    const dados = emLinhas(resultado(
      ['CODPROD', 'PRODUTO', 'CMV'],
      [[1075, 'PROAUTO SHAMPORIZADOR', 5348.57]],
    ));

    expect(dados).toEqual([
      { CODPROD: 1075, PRODUTO: 'PROAUTO SHAMPORIZADOR', CMV: 5348.57 },
    ]);
  });

  it('preserva a ordem das colunas', () => {
    const dados = emLinhas(resultado(['C', 'A', 'B'], [[1, 2, 3]]));

    expect(Object.keys(dados[0]))
      .withContext('a ordem do ERP é a ordem que a tela desenha')
      .toEqual(['C', 'A', 'B']);
  });

  it('lê várias linhas', () => {
    const dados = emLinhas(resultado(
      ['CODPROD', 'CMV'],
      [[1075, 5348.57], [2987, 3179.56], [1079, 1114.51]],
    ));

    expect(dados.length).toBe(3);
    expect(dados[2]['CODPROD']).toBe(1079);
  });

  it('resultado vazio vira lista vazia, e não erro', () => {
    expect(emLinhas(resultado(['CODPROD'], []))).toEqual([]);
  });

  /**
   * Consulta que não devolve nada — um `UPDATE`, ou erro tratado antes — não
   * pode derrubar a tela com "cannot read property of undefined".
   */
  it('sem metadata ou sem rows, devolve lista vazia', () => {
    expect(emLinhas({ fieldsMetadata: [], rows: [] })).toEqual([]);
    expect(emLinhas({} as ResultadoSankhya)).toEqual([]);
    expect(emLinhas(null as unknown as ResultadoSankhya)).toEqual([]);
  });

  /**
   * **`null` é dado, não ausência.** Um `LEFT JOIN` sem correspondência traz
   * null, e a coluna precisa existir no objeto — senão a tela não distingue
   * "não veio" de "veio vazio".
   */
  it('null vira null, e a coluna continua existindo', () => {
    const dados = emLinhas(resultado(['CODPROD', 'PRODUTO'], [[1075, null]]));

    expect('PRODUTO' in dados[0]).toBeTrue();
    expect(dados[0]['PRODUTO']).toBeNull();
  });

  /** Linha mais curta que o cabeçalho: o que faltou fica `null`, não some. */
  it('linha incompleta não desalinha as outras colunas', () => {
    const dados = emLinhas(resultado(['A', 'B', 'C'], [[1, 2]]));

    expect(dados[0]).toEqual({ A: 1, B: 2, C: null });
  });
});
