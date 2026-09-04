import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { TopbarComponent } from './topbar.component';

/**
 * **A busca do celular abre por cima da topbar.**
 *
 * O campo tinha largura fixa de 130px no celular, mas o respiro interno
 * continuava o do desktop — 32px de cada lado. Medido: sobravam 64px para um
 * placeholder que precisa de 95px, e o texto cortava.
 *
 * A lista de resultados cortava pelo mesmo motivo, e pior: ancorada pela
 * direita e com 340px de largura, presa a um `.search` de 130px no meio da
 * barra, a borda esquerda dela caía **fora da tela**.
 *
 * Alargar o campo no lugar não resolvia — num aparelho de 320px não há espaço
 * para dar. A topbar inteira é a única largura que existe em qualquer celular.
 */
describe('TopbarComponent · a busca no celular', () => {

  /** Abaixo de $bp-md (768px), que é onde a busca vira lupa. */
  const LARGURA_CELULAR = 390;

  let fixture: ComponentFixture<TopbarComponent>;
  let topbar: TopbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TopbarComponent);
    topbar = fixture.componentInstance;
    fixture.detectChanges();
  });

  const elemento = (seletor: string) =>
    fixture.nativeElement.querySelector(seletor) as HTMLElement | null;

  /**
   * Roda o trecho com a moldura do Karma na largura de um celular, para que as
   * regras de `@media` do SCSS realmente casem — e devolve a largura original
   * depois, mesmo se a expectativa falhar.
   */
  async function noCelular(trecho: () => Promise<void>): Promise<void> {
    const moldura = window.frameElement as HTMLElement | null;
    if (!moldura) {
      pending('a suíte não está rodando dentro do iframe do Karma; sem ele o @media não muda');
      return;
    }

    const antes = moldura.style.width;
    moldura.style.width = `${LARGURA_CELULAR}px`;
    await new Promise(requestAnimationFrame);

    try {
      await trecho();
    } finally {
      moldura.style.width = antes;
      await new Promise(requestAnimationFrame);
    }
  }

  it('nasce fechada', () => {
    expect(topbar.searchOpen()).toBeFalse();
  });

  it('tem a lupa que abre a busca, com o estado anunciado para leitores de tela', () => {
    const lupa = elemento('.search-trigger');

    expect(lupa).withContext('a lupa é o que ocupa o lugar do campo no celular').not.toBeNull();
    expect(lupa!.getAttribute('aria-expanded')).toBe('false');
  });

  it('a lupa abre a busca', async () => {
    elemento('.search-trigger')!.click();
    await fixture.whenStable();

    expect(topbar.searchOpen()).toBeTrue();
    expect(elemento('.search')!.classList).toContain('is-open');
    expect(elemento('.search-trigger')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('Cancelar fecha a busca e apaga o que foi escrito', async () => {
    topbar.openSearch();
    topbar.onSearchInput('rela');
    await fixture.whenStable();

    elemento('.search__cancel')!.click();
    await fixture.whenStable();

    expect(topbar.searchOpen()).withContext('a folha fecha').toBeFalse();
    expect(topbar.searchQuery()).withContext('e não guarda a busca anterior').toBe('');
    expect(topbar.showResults()).toBeFalse();
  });

  it('Esc fecha a busca, e não só limpa o texto', () => {
    topbar.openSearch();
    topbar.onSearchInput('rela');

    topbar.onSearchKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(topbar.searchOpen()).toBeFalse();
  });

  /**
   * Se `goToResult` só limpasse o texto, a folha ficaria aberta por cima da
   * tela para onde a pessoa acabou de navegar.
   */
  it('escolher um resultado fecha a busca', () => {
    topbar.openSearch();
    topbar.onSearchInput('rela');

    topbar.goToResult({ label: 'Qualquer', breadcrumb: 'Qualquer', icon: 'pi pi-file', routerLink: ['/'] } as never);

    expect(topbar.searchOpen()).toBeFalse();
  });

  it('tocar fora fecha a busca', () => {
    topbar.openSearch();

    topbar.onDocumentClick({ target: document.body } as unknown as MouseEvent);

    expect(topbar.searchOpen()).toBeFalse();
  });

  /**
   * **O teste que pega o defeito de verdade.**
   *
   * Não pergunta ao CSS gerado, pergunta ao navegador: com a busca aberta, o
   * espaço que sobra para o texto tem que caber o placeholder. É a mesma conta
   * que provou o defeito — largura do campo menos respiro menos bordas.
   *
   * **O estreitamento não é detalhe, é o teste.** O `@media` responde à largura
   * da janela, e a janela do Karma é de desktop: sem encolher a moldura, a
   * regra do celular nunca casa e o teste passa mesmo com o defeito de volta.
   * Foi o que aconteceu na primeira versão dele.
   */
  it('aberta, o campo cabe o texto do placeholder', async () => {
    await noCelular(async () => {
      topbar.openSearch();
      await fixture.whenStable();

      const campo = elemento('.search__input') as HTMLInputElement;
      const estilo = getComputedStyle(campo);

      const util = campo.getBoundingClientRect().width
        - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
        - parseFloat(estilo.borderLeftWidth) - parseFloat(estilo.borderRightWidth);

      const sonda = document.createElement('span');
      sonda.textContent = campo.placeholder;
      sonda.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
      sonda.style.font = estilo.font;
      document.body.appendChild(sonda);
      const texto = sonda.getBoundingClientRect().width;
      sonda.remove();

      expect(util)
        .withContext(`o placeholder "${campo.placeholder}" precisa de ${texto.toFixed(1)}px`)
        .toBeGreaterThanOrEqual(texto);
    });
  });

  /**
   * A lista de resultados tem que caber na tela pelas DUAS pontas. Ela é
   * ancorada pela direita e tinha largura fixa de 340px; presa a um `.search`
   * estreito no meio da barra, a borda esquerda dela ficava em x negativo.
   */
  it('aberta, a lista de resultados fica dentro da tela', async () => {
    await noCelular(async () => {
      topbar.openSearch();
      topbar.onSearchInput('a');
      await fixture.whenStable();

      const lista = fixture.nativeElement.querySelector('.search__dropdown') as HTMLElement;
      expect(lista).withContext('a lista precisa estar aberta para ser medida').not.toBeNull();

      const caixa = lista.getBoundingClientRect();

      expect(caixa.left)
        .withContext(`a borda esquerda da lista caiu em ${caixa.left.toFixed(1)}px`)
        .toBeGreaterThanOrEqual(0);

      expect(caixa.right)
        .withContext(`a borda direita passou de ${LARGURA_CELULAR}px`)
        .toBeLessThanOrEqual(LARGURA_CELULAR);
    });
  });
});
