import { desenharNoContexto, paraPng, medidorDoContexto, fonteEstaDisponivel } from './renderizador';
import type { TemplateDeAssinatura } from '../../models/assinatura-template.model';

/**
 * Estes testes rodam no Chrome do Karma, com canvas de verdade — é o único
 * jeito de afirmar que alguma coisa foi realmente pintada. As contas de
 * posição ficam em `desenho.spec.ts`, sem navegador.
 */
function template(ajustes: Partial<TemplateDeAssinatura['canvas']> = {}): TemplateDeAssinatura {
  return {
    versao: 1,
    canvas: {
      largura: 200, altura: 100, corDeFundo: '#ffffff',
      fundo: { caminho: null, ajuste: 'PREENCHER' },
      ...ajustes,
    },
    campos: [{
      id: 'a', chave: 'nome', rotulo: 'Nome', tipo: 'TEXTO',
      obrigatorio: true, exemplo: 'Exemplo',
      x: 0, y: 0, largura: 200, altura: 100,
      fonte: 'sans-serif', tamanho: 40, peso: 700, italico: false,
      cor: '#ff0000',
      alinhamento: 'ESQUERDA', alinhamentoVertical: 'TOPO',
      alturaDaLinha: 1.2, estouro: 'CORTAR', ordem: 0,
    }],
  };
}

function contexto(largura: number, altura: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  return canvas.getContext('2d')!;
}

/** A cor de um pixel, como texto, para a asserção ficar legível na falha. */
function pixel(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
  return `${r},${g},${b},${a}`;
}

describe('desenharNoContexto', () => {

  it('pinta o fundo na cor do template', () => {
    const ctx = contexto(200, 100);
    desenharNoContexto(ctx, template({ corDeFundo: '#0000ff' }), {}, null);
    expect(pixel(ctx, 190, 90)).toBe('0,0,255,255');
  });

  it('pinta o texto onde o campo manda', () => {
    // Nao e teste de fidelidade tipografica: e a prova de que a lista de
    // operacoes chega ao canvas. Sem ela, um renderizador que nao desenha nada
    // passa em tudo que so olha para dimensoes.
    const ctx = contexto(200, 100);
    desenharNoContexto(ctx, template(), { nome: 'HHHH' }, null);

    const dentroDoTexto = ctx.getImageData(0, 0, 60, 60).data;
    let vermelhos = 0;
    for (let i = 0; i < dentroDoTexto.length; i += 4) {
      if (dentroDoTexto[i] > 200 && dentroDoTexto[i + 1] < 60) vermelhos++;
    }
    expect(vermelhos).toBeGreaterThan(0);
  });

  it('nao pinta nada fora do campo sem valor', () => {
    const ctx = contexto(200, 100);
    desenharNoContexto(ctx, template(), {}, null);
    expect(pixel(ctx, 10, 10)).toBe('255,255,255,255');
  });
});

describe('paraPng', () => {

  it('sai no tamanho exato do template mesmo numa tela de alta densidade', async () => {
    // A armadilha do devicePixelRatio, e o motivo de FORCAR o valor aqui: o
    // Chrome do Karma roda com dpr 1, entao um teste que so chamasse `paraPng`
    // passaria com e sem o defeito — e o PNG sairia errado exatamente na
    // maquina de quem usa a tela, que roda o Windows a 125%.
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

    try {
      const blob = await paraPng(template(), { nome: 'Ana' }, null);
      const bitmap = await createImageBitmap(blob);

      expect(bitmap.width).toBe(200);
      expect(bitmap.height).toBe(100);
      bitmap.close();
    } finally {
      if (original) Object.defineProperty(window, 'devicePixelRatio', original);
    }
  });

  it('devolve um PNG de verdade', () => {
    return paraPng(template(), { nome: 'Ana' }, null).then(blob => {
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});

describe('medidorDoContexto', () => {

  it('devolve o ascent da caixa da fonte, que nao muda com as letras', () => {
    // Com actualBoundingBoxAscent, 'acme' (sem ascendente) e 'Acme' (com)
    // dariam valores diferentes, e as linhas pulariam enquanto se digita.
    const medir = medidorDoContexto(contexto(10, 10));
    expect(medir('acme', '700 40px sans-serif').ascent)
      .toBe(medir('Acme', '700 40px sans-serif').ascent);
  });

  it('mede mais largura para mais texto', () => {
    const medir = medidorDoContexto(contexto(10, 10));
    expect(medir('mmmm', '700 40px sans-serif').largura)
      .toBeGreaterThan(medir('m', '700 40px sans-serif').largura);
  });
});

describe('fonteEstaDisponivel', () => {

  it('reconhece uma familia que o navegador tem', () => {
    // Arial, e nao um generico como `monospace`: a funcao poe a familia entre
    // aspas, e aspas transformam a palavra-chave generica numa busca por uma
    // fonte CHAMADA "monospace" — que nao existe. Fonte real e o caso de uso.
    expect(fonteEstaDisponivel(contexto(10, 10), 'Arial')).toBeTrue();
  });

  it('acusa a familia que caiu na substituta', () => {
    // E esta a diferenca entre entregar o PNG errado calado e recusar.
    expect(fonteEstaDisponivel(contexto(10, 10), 'FonteQueNaoExisteNoSistema123')).toBeFalse();
  });
});
