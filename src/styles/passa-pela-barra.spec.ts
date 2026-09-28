import { NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, restaurarLargura } from '../testing/test-setup';

/**
 * **A barra de baixo e o conteúdo que passa por trás dela** (opção B, 2026-09-28).
 *
 * Lê o CSS de verdade (o `_shell.scss` global) numa árvore que imita o shell:
 * `.app-content` com a tela dentro. Afirmar a string do SCSS não pegaria o que
 * importa — se o navegador aplica ou descarta a regra.
 *
 * O teste roda sem área segura (`env(safe-area-inset-bottom)` = 0), então a
 * reserva é 52 (cápsula) + 15 × 2 (vãos) = 82px.
 */
describe('passa-pela-barra (shell)', () => {
  let shell: HTMLElement;
  let tela: HTMLElement;

  function montar(largura: number, optIn: boolean): void {
    larguraDaJanela(largura);
    shell = document.createElement('div');
    shell.className = 'app-content';
    tela = document.createElement('div');
    if (optIn) tela.className = 'passa-pela-barra';
    shell.appendChild(tela);
    document.body.appendChild(shell);
  }

  afterEach(() => {
    shell.remove();
    restaurarLargura();
  });

  it('por padrão o celular reserva o espaço da barra — nenhuma tela muda sem ser conferida', () => {
    montar(NO_CELULAR, false);
    expect(getComputedStyle(shell).paddingBottom).toBe('82px');
  });

  it('a tela conferida vai até o pé, e leva a reserva para o fim da própria rolagem', () => {
    montar(NO_CELULAR, true);
    expect(getComputedStyle(shell).paddingBottom).toBe('0px');
    expect(getComputedStyle(tela).getPropertyValue('--scroll-end-reserve').trim()).not.toBe('');
  });

  it('no computador não há barra de baixo, e nada é reservado', () => {
    montar(NO_COMPUTADOR, true);
    expect(getComputedStyle(shell).paddingBottom).toBe('0px');
  });
});
