import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ToolbarComponent } from './toolbar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkFileUploadComponent } from '../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';

/**
 * O botão de importar planilha, dentro da toolbar.
 *
 * Em `mode="button"` o `pk-fileUpload` renderiza um `pk-button` de verdade, com
 * o mesmo `pkSize` dos vizinhos — então ele deveria ser indistinguível deles.
 * Não era.
 *
 * **Medido em 2026-09-09:** a casca tinha 46px para conter um botão de 34. A
 * causa não é o botão: o wrapper `.pk-upload` é flex em coluna com
 * `gap: .75rem`, e o `<p-fileupload>` — que é só o input escondido — continuava
 * sendo um item flex de altura zero. O `styleClass` do PrimeNG põe a classe num
 * elemento INTERNO, então o host nunca recebia o `display: none`, e o gap se
 * aplicava entre ele e o botão.
 *
 * O teste afirma o fato estrutural, e não a medida em pixels: altura depende do
 * contexto de layout, e um teste que passa sozinho e falha na suíte é pior que
 * nenhum — treina a ignorar vermelho.
 */
@Component({
  standalone: true,
  imports: [ToolbarComponent, PkButtonComponent, PkFileUploadComponent],
  template: `
    <app-toolbar>
      <pk-button pkType="new" pkSize="sm" pkLabel="Novo" />
      <pk-fileUpload mode="button" chooseLabel="Importar Excel"
                     chooseType="excel" chooseSize="sm" accept=".xlsx" />
    </app-toolbar>
  `,
})
class HostDeTeste { }

describe('Toolbar · o botão de importar', () => {

  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostDeTeste],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostDeTeste);
    fixture.detectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => TestBed.resetTestingModule());

  /**
   * O input escondido não pode ocupar vaga no flex.
   *
   * Tirar esta linha devolve os 12px de gap, e o botão volta a boiar dentro de
   * uma casca mais alta que ele.
   */
  it('o input escondido não é um item flex', () => {
    const input = root.querySelector('pk-fileUpload p-fileupload');

    expect(input).withContext('o input continua no DOM, e clicável').not.toBeNull();
    expect(getComputedStyle(input!).display)
      .withContext('block de altura zero ainda recebe o gap do wrapper')
      .toBe('contents');
  });

  /**
   * A casca tem que caber no conteúdo, e não o contrário.
   *
   * A comparação é com o HOST `pk-button`, e não com o `.pk-btn` de dentro: o
   * host é `display: block` e mede 2px a mais que o botão em qualquer lugar da
   * faixa. Comparar com o botão interno faria o teste falhar por uma diferença
   * que existe em todos os vizinhos igual.
   */
  it('a casca não fica mais alta que o botão que ela contém', () => {
    const wrapper = root.querySelector('pk-fileUpload .pk-upload')!;
    const button = root.querySelector('pk-fileUpload pk-button')!;

    expect(Math.round(wrapper.getBoundingClientRect().height))
      .toBe(Math.round(button.getBoundingClientRect().height));
  });

  /** E o botão do upload é do mesmo tamanho dos vizinhos, com o mesmo pkSize. */
  it('tem a mesma altura dos outros botões da faixa', () => {
    const plain = root.querySelector('app-toolbar > pk-button .pk-btn')
               ?? root.querySelector('pk-button .pk-btn')!;
    const upload = root.querySelector('pk-fileUpload .pk-btn')!;

    expect(Math.round(upload.getBoundingClientRect().height))
      .toBe(Math.round(plain.getBoundingClientRect().height));
  });
});
