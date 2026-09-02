import {
  quebrarLinhas, encolherParaCaber, operacoesDoCampo, operacoesDoTemplate, fonteCss,
  type Medidor,
} from './desenho';
import type { CampoDoTemplate, TemplateDeAssinatura } from '../../models/assinatura-template.model';

/**
 * Medidor de mentira, e é ele que torna tudo isto testável sem navegador:
 * cada caractere mede um décimo do tamanho da fonte, e o ascent é 80% dela.
 * Números redondos, contas conferíveis à mão.
 */
const medir: Medidor = (texto, fonte) => {
  const tamanho = Number(/(\d+(?:\.\d+)?)px/.exec(fonte)![1]);
  return { largura: texto.length * tamanho * 0.1, ascent: tamanho * 0.8 };
};

function campo(ajustes: Partial<CampoDoTemplate> = {}): CampoDoTemplate {
  return {
    id: 'id-1', chave: 'nome', rotulo: 'Nome', tipo: 'TEXTO',
    obrigatorio: true, exemplo: 'Exemplo',
    x: 100, y: 50, largura: 200, altura: 40,
    fonte: 'Montserrat', tamanho: 20, peso: 700, italico: false, cor: '#232E61',
    alinhamento: 'ESQUERDA', alinhamentoVertical: 'TOPO',
    alturaDaLinha: 1.2, estouro: 'CORTAR', ordem: 0,
    ...ajustes,
  };
}

describe('quebrarLinhas', () => {

  it('acumula palavras enquanto couberem', () => {
    // 20px, entao 2px por caractere. Em 200px cabem 100 caracteres.
    const linhas = quebrarLinhas(medir, 'um dois tres', fonteCss(campo()), 200);
    expect(linhas).toEqual(['um dois tres']);
  });

  it('quebra quando a proxima palavra nao cabe', () => {
    // Em 12px de largura cabem 6 caracteres: 'um' e 'dois' nao somam numa linha.
    const linhas = quebrarLinhas(medir, 'um dois tres', fonteCss(campo()), 12);
    expect(linhas).toEqual(['um', 'dois', 'tres']);
  });

  it('nao entra em laco com uma palavra maior que a caixa', () => {
    // O defeito classico: tentar caber o incabivel e nunca terminar. Se este
    // teste travar a suite em vez de falhar, e exatamente esse defeito.
    const linhas = quebrarLinhas(medir, 'antidesestabelecimentarianismo', fonteCss(campo()), 10);
    expect(linhas).toEqual(['antidesestabelecimentarianismo']);
  });

  it('respeita a quebra que o texto ja traz', () => {
    expect(quebrarLinhas(medir, 'um\ndois', fonteCss(campo()), 500)).toEqual(['um', 'dois']);
  });

  it('devolve uma linha vazia para texto vazio, e nao uma lista vazia', () => {
    expect(quebrarLinhas(medir, '', fonteCss(campo()), 200)).toEqual(['']);
  });
});

describe('encolherParaCaber', () => {

  it('nao mexe no tamanho quando ja cabe', () => {
    expect(encolherParaCaber(medir, 'curto', campo())).toBe(20);
  });

  it('diminui ate caber', () => {
    // 120 caracteres medem 240px no tamanho 20 e nao cabem nos 200 da caixa;
    // no piso (12) mediriam 144 e sobraria espaco. Ou seja, existe resposta
    // ENTRE o nominal e o piso — que e o que este teste afirma. Um texto longo
    // demais so provaria que a funcao para no piso, que e o teste seguinte.
    const texto = 'a'.repeat(120);
    const tamanho = encolherParaCaber(medir, texto, campo());

    expect(tamanho).toBeLessThan(20);
    expect(tamanho).toBeGreaterThan(12);
    expect(medir(texto, fonteCss(campo(), tamanho)).largura).toBeLessThanOrEqual(200);
  });

  it('para no piso em vez de virar formiga', () => {
    // Sem piso, um texto absurdo levaria o tamanho a zero ou a negativo. E um
    // `0px` no ctx.font e ignorado, entao o canvas desenharia na fonte anterior.
    const tamanho = encolherParaCaber(medir, 'a'.repeat(10000), campo());
    expect(tamanho).toBe(12);
  });
});

describe('operacoesDoCampo', () => {

  it('nao desenha nada quando nao ha valor', () => {
    expect(operacoesDoCampo(campo(), '', medir)).toEqual([]);
    expect(operacoesDoCampo(campo(), '   ', medir)).toEqual([]);
  });

  it('poe a baseline abaixo do topo pelo ascent', () => {
    const [op] = operacoesDoCampo(campo({ alinhamentoVertical: 'TOPO' }), 'Ana', medir);
    // topo 50 + ascent (20 x 0,8 = 16)
    expect(op.y).toBe(66);
  });

  it('centraliza o bloco na vertical', () => {
    const [op] = operacoesDoCampo(campo({ alinhamentoVertical: 'MEIO' }), 'Ana', medir);
    // bloco = 1 linha x 20 x 1,2 = 24. Sobra 40 - 24 = 16, metade 8.
    // topo = 50 + 8 = 58, mais o ascent 16.
    expect(op.y).toBe(74);
  });

  it('encosta o bloco na base', () => {
    const [op] = operacoesDoCampo(campo({ alinhamentoVertical: 'BASE' }), 'Ana', medir);
    // topo = 50 + 40 - 24 = 66, mais o ascent 16.
    expect(op.y).toBe(82);
  });

  it('move o x junto com o alinhamento horizontal', () => {
    // O canvas alinha em relacao a coordenada dada, nao a caixa: manter o x e
    // so trocar o textAlign desenharia fora da caixa.
    const [esq] = operacoesDoCampo(campo({ alinhamento: 'ESQUERDA' }), 'Ana', medir);
    const [ctr] = operacoesDoCampo(campo({ alinhamento: 'CENTRO' }), 'Ana', medir);
    const [dir] = operacoesDoCampo(campo({ alinhamento: 'DIREITA' }), 'Ana', medir);

    expect([esq.x, esq.alinhamento]).toEqual([100, 'left']);
    expect([ctr.x, ctr.alinhamento]).toEqual([200, 'center']);
    expect([dir.x, dir.alinhamento]).toEqual([300, 'right']);
  });

  it('empilha as linhas pela altura de linha, e nao pelo tamanho da fonte', () => {
    const ops = operacoesDoCampo(
      campo({ estouro: 'QUEBRAR', largura: 12, altura: 200 }), 'um dois tres', medir);
    expect(ops.length).toBe(3);
    // 20 x 1,2 = 24 entre baselines. Com 20 (o tamanho puro) elas ficariam juntas.
    expect(ops[1].y - ops[0].y).toBe(24);
    expect(ops[2].y - ops[1].y).toBe(24);
  });

  it('da o mesmo ascent a todas as linhas', () => {
    // Medido por linha, o ascent mudaria com as letras de cada uma e o
    // espacamento sairia irregular.
    const ops = operacoesDoCampo(
      campo({ estouro: 'QUEBRAR', largura: 12, altura: 200 }), 'acme ACME acme', medir);
    const saltos = ops.slice(1).map((op, i) => op.y - ops[i].y);
    expect(new Set(saltos).size).toBe(1);
  });

  it('so pede recorte no modo CORTAR', () => {
    expect(operacoesDoCampo(campo({ estouro: 'CORTAR' }), 'Ana', medir)[0].recorte)
      .toEqual({ x: 100, y: 50, largura: 200, altura: 40 });
    expect(operacoesDoCampo(campo({ estouro: 'ENCOLHER' }), 'Ana', medir)[0].recorte).toBeNull();
  });
});

describe('operacoesDoTemplate', () => {

  const template = (): TemplateDeAssinatura => ({
    versao: 1,
    canvas: { largura: 700, altura: 300, corDeFundo: '#fff',
              fundo: { caminho: null, ajuste: 'PREENCHER' } },
    campos: [
      campo({ id: 'b', chave: 'cargo', ordem: 1, y: 100 }),
      campo({ id: 'a', chave: 'nome',  ordem: 0, y: 50 }),
    ],
  });

  it('desenha na ordem de empilhamento, nao na ordem da lista', () => {
    const ops = operacoesDoTemplate(template(), { nome: 'Ana', cargo: 'TI' }, medir);
    expect(ops.map(o => o.texto)).toEqual(['Ana', 'TI']);
  });

  it('nao altera a lista de campos do template', () => {
    // A ordenacao e sobre uma copia: mexer no array original mudaria a ordem
    // da lista de camadas do editor a cada redesenho.
    const t = template();
    operacoesDoTemplate(t, { nome: 'Ana', cargo: 'TI' }, medir);
    expect(t.campos.map(c => c.chave)).toEqual(['cargo', 'nome']);
  });

  it('ignora campo sem valor e desenha o resto', () => {
    const ops = operacoesDoTemplate(template(), { nome: 'Ana' }, medir);
    expect(ops.map(o => o.texto)).toEqual(['Ana']);
  });
});
