import {
  pontoNoTemplate, prenderNaTela, chaveDisponivel, campoNovo, comCampoTrocado, semCampo,
} from './editor';
import type { CampoDoTemplate, CanvasDoTemplate } from '../../models/assinatura-template.model';

const canvas: CanvasDoTemplate = {
  largura: 700, altura: 300, corDeFundo: '#fff',
  fundo: { caminho: null, ajuste: 'PREENCHER' },
};

function campo(ajustes: Partial<CampoDoTemplate> = {}): CampoDoTemplate {
  return {
    id: 'a', chave: 'nome', rotulo: 'Nome', tipo: 'TEXTO',
    obrigatorio: true, exemplo: 'Maria',
    x: 100, y: 50, largura: 200, altura: 40,
    fonte: 'Montserrat', tamanho: 20, peso: 700, italico: false, cor: '#232E61',
    alinhamento: 'ESQUERDA', alinhamentoVertical: 'TOPO',
    alturaDaLinha: 1.2, estouro: 'ENCOLHER', ordem: 0,
    ...ajustes,
  };
}

describe('pontoNoTemplate', () => {

  it('converte na escala 1, quando o canvas aparece no tamanho real', () => {
    const area = { left: 0, top: 0, width: 700, height: 300 };
    expect(pontoNoTemplate(350, 150, area, canvas)).toEqual({ x: 350, y: 150 });
  });

  it('desconta a posicao do canvas na pagina', () => {
    // Sem descontar, arrastar funciona no canto superior esquerdo da tela e
    // erra em qualquer outro lugar - e a tela tem cabecalho em cima.
    const area = { left: 100, top: 200, width: 700, height: 300 };
    expect(pontoNoTemplate(450, 350, area, canvas)).toEqual({ x: 350, y: 150 });
  });

  it('converte quando o canvas esta exibido menor que o arquivo', () => {
    // O caso normal: canvas de 700 desenhado em 350 CSS px. Sem a escala, o
    // campo anda metade do que o ponteiro anda.
    const area = { left: 0, top: 0, width: 350, height: 150 };
    expect(pontoNoTemplate(175, 75, area, canvas)).toEqual({ x: 350, y: 150 });
  });

  it('escala os dois eixos separadamente', () => {
    // Uma escala so daria certo por acidente enquanto a proporcao fosse a
    // mesma, e erraria no dia em que o designer trocasse a arte.
    const area = { left: 0, top: 0, width: 350, height: 300 };
    expect(pontoNoTemplate(175, 150, area, canvas)).toEqual({ x: 350, y: 150 });
  });
});

describe('prenderNaTela', () => {

  it('nao mexe em campo que ja esta dentro', () => {
    expect(prenderNaTela(campo(), canvas)).toEqual(jasmine.objectContaining({ x: 100, y: 50 }));
  });

  it('segura no canto quando arrastam para fora pela esquerda ou pelo topo', () => {
    const preso = prenderNaTela(campo({ x: -80, y: -30 }), canvas);
    expect([preso.x, preso.y]).toEqual([0, 0]);
  });

  it('deixa o campo inteiro visivel na direita e embaixo', () => {
    // Prender so o canto superior esquerdo em largura/altura deixaria o campo
    // pendurado meio para fora, e a alca fora de alcance.
    const preso = prenderNaTela(campo({ x: 900, y: 500 }), canvas);
    expect([preso.x, preso.y]).toEqual([500, 260]);
  });

  it('arredonda para pixel inteiro', () => {
    expect(prenderNaTela(campo({ x: 10.7, y: 20.2 }), canvas).x).toBe(11);
  });
});

describe('chaveDisponivel', () => {

  it('recusa uma chave que outro campo ja usa', () => {
    const campos = [campo({ id: 'a', chave: 'nome' }), campo({ id: 'b', chave: 'cargo' })];
    expect(chaveDisponivel(campos, 'cargo', 'a')).toBeFalse();
  });

  it('deixa o campo manter a propria chave', () => {
    // Sem ignorar o proprio id, editar o rotulo de um campo acusaria conflito
    // com ele mesmo e travaria a tela.
    const campos = [campo({ id: 'a', chave: 'nome' })];
    expect(chaveDisponivel(campos, 'nome', 'a')).toBeTrue();
  });

  it('nao distingue maiuscula nem espaco em volta', () => {
    // 'Nome' e 'nome ' viram a mesma chave no payload, entao aceitar as duas
    // criaria um par de campos que se sobrescrevem.
    const campos = [campo({ id: 'a', chave: 'nome' })];
    expect(chaveDisponivel(campos, '  NOME ', 'b')).toBeFalse();
  });

  it('recusa chave vazia', () => {
    expect(chaveDisponivel([], '   ', 'a')).toBeFalse();
  });
});

describe('campoNovo', () => {

  it('nasce no meio da tela', () => {
    const novo = campoNovo([], canvas);
    expect(novo.x).toBe(Math.round((700 - novo.largura) / 2));
    expect(novo.y).toBe(Math.round((300 - novo.altura) / 2));
  });

  it('nao repete uma chave que ja existe', () => {
    // Com um campo chamado 'campo1' na lista, o proximo nao pode ser 'campo1'.
    const campos = [campo({ id: 'a', chave: 'campo1' })];
    expect(campoNovo(campos, canvas).chave).not.toBe('campo1');
  });

  it('herda a fonte e a cor do primeiro campo, e nao um padrao qualquer', () => {
    const campos = [campo({ fonte: 'Arial', cor: '#ff0000' })];
    const novo = campoNovo(campos, canvas);
    expect([novo.fonte, novo.cor]).toEqual(['Arial', '#ff0000']);
  });

  it('entra por cima dos que ja existem', () => {
    const campos = [campo({ ordem: 0 }), campo({ id: 'b', chave: 'x', ordem: 1 })];
    expect(campoNovo(campos, canvas).ordem).toBe(2);
  });
});

describe('comCampoTrocado', () => {

  it('troca so o campo do id, e devolve lista nova', () => {
    const campos = [campo({ id: 'a' }), campo({ id: 'b', chave: 'cargo' })];
    const trocados = comCampoTrocado(campos, campo({ id: 'b', chave: 'cargo', x: 999 }));

    expect(trocados[0]).toBe(campos[0]);
    expect(trocados[1].x).toBe(999);
    // Lista nova: o effect que redesenha depende da identidade para disparar.
    expect(trocados).not.toBe(campos);
  });
});

describe('semCampo', () => {

  it('remove e renumera a ordem sem deixar buraco', () => {
    const campos = [
      campo({ id: 'a', ordem: 0 }),
      campo({ id: 'b', chave: 'x', ordem: 1 }),
      campo({ id: 'c', chave: 'y', ordem: 2 }),
    ];
    expect(semCampo(campos, 'b').map(c => [c.id, c.ordem]))
      .toEqual([['a', 0], ['c', 1]]);
  });
});
