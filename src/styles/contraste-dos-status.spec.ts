/**
 * **Os pares de status têm de passar na régua de TEXTO: 4,5:1.**
 *
 * Chip é texto, não objeto gráfico — a régua de 3:1 vale para ícone, e usá-la
 * aqui foi o erro que deixou estes pares reprovando por tanto tempo. O oposto
 * também já custou caro: mirar 4,5 em ícone de categoria fez sair tinta preta.
 *
 * O teste lê os tokens **do CSS de verdade** (o `styles.scss` entra no bundle
 * de teste), e não uma cópia da paleta num array: uma cópia concorda consigo
 * mesma para sempre e não notaria alguém mexendo no tema.
 *
 * O `soft` é `rgba`, então ele é **composto sobre a superfície** antes de
 * medir. Medir o rgba direto dá a razão de uma cor que não existe na tela.
 */
describe('Contraste dos pares de status', () => {

  /** A régua de texto do WCAG 2.1 (1.4.3). */
  const MINIMO = 4.5;

  const PAPEIS = ['action', 'success', 'warning', 'danger', 'info', 'work'] as const;

  function valor(nome: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  }

  /** Aceita `#rgb`, `#rrggbb` e `rgb()/rgba()`. */
  function cor(css: string): [number, number, number, number] {
    if (css.startsWith('#')) {
      const h = css.slice(1);
      const p = h.length === 3 ? h.split('').map(c => c + c) : h.match(/../g)!;
      return [parseInt(p[0], 16), parseInt(p[1], 16), parseInt(p[2], 16), 1];
    }

    const n = css.match(/[\d.]+/g)!.map(Number);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  }

  function sobre(frente: [number, number, number, number], fundo: [number, number, number, number]) {
    const a = frente[3];
    return [0, 1, 2].map(i => frente[i] * a + fundo[i] * (1 - a)) as [number, number, number];
  }

  function lum([r, g, b]: number[]): number {
    const c = [r, g, b].map(v => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function razao(a: number[], b: number[]): number {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function medirTodos(): { papel: string; r: number }[] {
    const superficie = cor(valor('--app-surface'));

    return PAPEIS.map(papel => {
      const tinta = cor(valor(`--app-${papel}`));
      const fundo = sobre(cor(valor(`--app-${papel}-soft`)), superficie);
      return { papel, r: razao(tinta.slice(0, 3), fundo) };
    });
  }

  afterEach(() => document.documentElement.classList.remove('dark-mode'));

  it('o tema claro passa em todos os papéis', () => {
    for (const { papel, r } of medirTodos()) {
      expect(r).withContext(`${papel} claro: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(MINIMO);
    }
  });

  it('o tema escuro passa em todos os papéis', () => {
    document.documentElement.classList.add('dark-mode');

    for (const { papel, r } of medirTodos()) {
      expect(r).withContext(`${papel} escuro: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(MINIMO);
    }
  });

  /**
   * A tinta aparece MUITO mais como texto solto no cartão (contagem, valor,
   * rótulo) do que dentro do chip — e três delas reprovavam justamente aí. O
   * chip é o caso mais apertado, mas não é o único.
   */
  it('a tinta também passa direto sobre o cartão, sem o fundo do chip', () => {
    const superficie = cor(valor('--app-surface')).slice(0, 3);

    for (const papel of PAPEIS) {
      const r = razao(cor(valor(`--app-${papel}`)).slice(0, 3), superficie);
      expect(r).withContext(`${papel} sobre o cartão: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(MINIMO);
    }
  });
});
