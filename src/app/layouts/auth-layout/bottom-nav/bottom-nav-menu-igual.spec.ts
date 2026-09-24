import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { BottomNavComponent } from './bottom-nav.component';
import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { MOBILE_NAV } from '../menu.config';

/**
 * O item "Menu" tem que ser indistinguível dos vizinhos.
 *
 * <p><b>O defeito que este arquivo existe para impedir.</b> "Menu" abre a
 * gaveta, então é `<button>`; os outros navegam, e são `<a>`. Botão não herda
 * `font-family` e nasce com fundo, borda e padding do navegador — e a classe
 * `.bottom-nav__item` tinha sido escrita para âncora, sem resetar nada disso.
 * O resultado apareceu no aparelho: um item com cara de botão de formulário no
 * meio de quatro ícones.
 *
 * <p>As asserções são sobre <b>estilo computado</b>, e não sobre classe: a
 * classe estava certa nos dois o tempo todo. Só o navegador sabia a diferença.
 */
describe('BottomNavComponent · o Menu parece com os vizinhos', () => {

  async function montar() {
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MenuService, useValue: { mobileItems: () => MOBILE_NAV } },
        { provide: TelasRecentesService, useValue: { porHabito: () => [] } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;

    return {
      botao: raiz.querySelector('button.bottom-nav__item') as HTMLElement,
      ancora: raiz.querySelector('a.bottom-nav__item') as HTMLElement,
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('o Menu e um botao, e os vizinhos sao links', async () => {
    const { botao, ancora } = await montar();

    expect(botao).withContext('o Menu abre uma camada, nao navega').not.toBeNull();
    expect(ancora).not.toBeNull();
  });

  /**
   * `font-family` é a que mais denuncia: o navegador dá ao botão a fonte dele,
   * e o rótulo sai com desenho diferente do dos vizinhos.
   */
  it('a fonte do Menu e a mesma dos vizinhos', async () => {
    const { botao, ancora } = await montar();

    const doBotao = getComputedStyle(botao);
    const daAncora = getComputedStyle(ancora);

    expect(doBotao.fontFamily).toBe(daAncora.fontFamily);
    expect(doBotao.fontSize).toBe(daAncora.fontSize);
    expect(doBotao.fontWeight).toBe(daAncora.fontWeight);
  });

  it('o Menu nao tem fundo, borda nem respiro proprios', async () => {
    const { botao, ancora } = await montar();

    const doBotao = getComputedStyle(botao);
    const daAncora = getComputedStyle(ancora);

    expect(doBotao.backgroundColor)
      .withContext('fundo do botao o destaca no meio da barra')
      .toBe(daAncora.backgroundColor);
    expect(doBotao.borderStyle).toBe(daAncora.borderStyle);
    expect(doBotao.paddingTop).toBe(daAncora.paddingTop);
    expect(doBotao.paddingLeft).toBe(daAncora.paddingLeft);
  });

  it('o Menu tem a mesma cor de texto dos vizinhos inativos', async () => {
    const { botao, ancora } = await montar();

    expect(getComputedStyle(botao).color).toBe(getComputedStyle(ancora).color);
  });
});
