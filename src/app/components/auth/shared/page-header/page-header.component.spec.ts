import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';
import {
  NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura,
} from '../../../../../testing/test-setup';

/**
 * **Cabeçalho compacto no celular** (decidido por ele em 2026-09-28, "compacto
 * com subtítulo").
 *
 * Medido na Newsletter a 390px: o conteúdo só começava em 111px — cabeçalho de
 * 67px (título de 21,6px) e 28px de margem. O mesmo componente está em 41
 * telas, então a regra mora aqui. O computador não muda.
 */
describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderComponent>;

  function montar(largura: number, size: 'default' | 'lg' = 'default'): HTMLElement {
    larguraDaJanela(largura);
    TestBed.configureTestingModule({ imports: [PageHeaderComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Newsletter');
    fixture.componentRef.setInput('subtitle', 'Conferir os números do mês e liberar o disparo antes do dia 10');
    fixture.componentRef.setInput('icon', 'pi pi-envelope');
    if (size === 'lg') fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const estilo = (el: HTMLElement, sel: string) => getComputedStyle(el.querySelector(sel) as HTMLElement);

  afterEach(() => restaurarLargura());

  describe('no celular', () => {
    it('título de uma linha, com reticências, em 17,6px', () => {
      const el = montar(NO_CELULAR);
      const titulo = estilo(el, '.page-header__title');
      expect(titulo.fontSize).toBe('17.6px');
      expect(titulo.whiteSpace).toBe('nowrap');
      expect(titulo.textOverflow).toBe('ellipsis');
    });

    it('subtítulo fica, numa linha só, em 12px', () => {
      const el = montar(NO_CELULAR);
      const sub = estilo(el, '.page-header__subtitle');
      expect(sub.display).not.toBe('none');
      expect(sub.fontSize).toBe('12px');
      expect(sub.whiteSpace).toBe('nowrap');
    });

    it('ícone de 32px e 12px de margem abaixo — e só ela', () => {
      const el = montar(NO_CELULAR);
      expect(estilo(el, '.page-header__icon').width).toBe('32px');
      expect(getComputedStyle(el).marginBottom).toBe('12px');
      // Uma regra global antiga de `.page-header` somava 24px por dentro.
      expect(estilo(el, '.page-header').marginBottom).toBe('0px');
    });

    it('o de hub (grande) também encolhe: título de 20px', () => {
      const el = montar(NO_CELULAR, 'lg');
      expect(estilo(el, '.page-header__title').fontSize).toBe('20px');
    });
  });

  describe('no computador', () => {
    it('continua como era', () => {
      const el = montar(NO_COMPUTADOR);
      expect(estilo(el, '.page-header__title').fontSize).toBe('21.6px');
      expect(estilo(el, '.page-header__title').whiteSpace).not.toBe('nowrap');
      expect(getComputedStyle(el).marginBottom).toBe('28px');
    });
  });
});
