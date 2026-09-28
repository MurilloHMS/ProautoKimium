import { NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, restaurarLargura } from '../testing/test-setup';

/**
 * **A barra de baixo e o conteúdo que passa por trás dela** (opção B, 2026-09-28).
 *
 * Lê o CSS de verdade (os parciais globais) numa árvore que imita o shell:
 * `.app-content` com a tela dentro. Afirmar a string do SCSS não pegaria o que
 * importa — se o navegador aplica ou descarta a regra.
 *
 * O teste roda sem área segura (`env(safe-area-inset-bottom)` = 0), então a
 * reserva é 52 (cápsula) + 15 × 2 (vãos) = 82px.
 */
describe('barra de baixo: o conteúdo passa pelos vãos (shell)', () => {
  let shell: HTMLElement;
  let banner: HTMLElement;
  let tela: HTMLElement;

  /**
   * O DOM de verdade do `.app-content`: o banner de instalar vem ANTES do
   * `router-outlet`, e a tela roteada entra DEPOIS dele. A primeira versão
   * deste teste montava só a tela — e o espaçador que caiu também no banner
   * empurrou o título de todas as telas para baixo, com o teste verde.
   */
  function montar(largura: number): void {
    larguraDaJanela(largura);
    shell = document.createElement('div');
    shell.className = 'app-content';
    banner = document.createElement('app-instalar');
    banner.style.display = 'block';
    tela = document.createElement('div');
    shell.append(banner, document.createElement('router-outlet'), tela);
    document.body.appendChild(shell);
  }

  afterEach(() => {
    shell.remove();
    restaurarLargura();
  });

  it('no celular o shell não reserva mais o pé: a tela vai até embaixo', () => {
    montar(NO_CELULAR);
    expect(getComputedStyle(shell).paddingBottom).toBe('0px');
  });

  /** O último item para acima da cápsula: o espaço está no FIM da rolagem. */
  it('a tela que rola inteira termina com o espaço da barra', () => {
    montar(NO_CELULAR);
    expect(getComputedStyle(tela, '::after').height).toBe('82px');
  });

  /** O que empurrou o título de todas as telas para o meio, em 2026-09-28. */
  it('o espaçador não cai no banner de instalar, que vem antes da tela', () => {
    montar(NO_CELULAR);
    expect(getComputedStyle(banner, '::after').content).toBe('none');
    expect(banner.getBoundingClientRect().height).toBe(0);
  });

  it('no computador não há barra de baixo, e nada é reservado', () => {
    montar(NO_COMPUTADOR);
    expect(getComputedStyle(shell).paddingBottom).toBe('0px');
    // Sem regra no computador, o pseudo-elemento nem existe.
    expect(getComputedStyle(tela, '::after').content).toBe('none');
  });

  // Quem rola num contêiner próprio (a lista `.cartoes` da Programação e de
  // Eventos, o detalhe de Movimentações…) soma no fim o espaço que a tela de
  // grade repassa em `--scroll-end-reserve`. Não dá para testar aqui: o
  // `.cartoes` NÃO é global — cada tela o declara no próprio SCSS, e é lá que
  // o `padding-bottom` mora. Descoberto quando o teste daqui falhou.
});
