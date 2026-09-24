import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormScreenComponent } from './form-screen.component';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * O modo formulário das telas de cadastro, agora com duas molduras.
 *
 * <p><b>O defeito que este arquivo existe para impedir.</b> O corpo e as ações
 * chegam por `<ng-content>`, e conteúdo projetado aparece <b>uma vez só</b>.
 * Repetir o `<ng-content>` nos dois ramos do `@if` compila, passa no build e
 * deixa a folha <b>vazia</b> — o formulário abre sem campo nenhum e sem botão
 * de salvar. Por isso o conteúdo mora num `ng-template` servido às duas
 * molduras por `ngTemplateOutlet`.
 *
 * <p>Os testes montam um hospedeiro de verdade, com campo e botões projetados,
 * porque é justamente a projeção que quebra.
 */
@Component({
  standalone: true,
  imports: [FormScreenComponent],
  template: `
    <app-form-screen title="Novo equipamento" subtitle="Equipamento do site" (back)="voltou.set(true)">
      <label for="nome">Nome do equipamento</label>
      <input id="nome" type="text" />

      <div formActions>
        <button type="button" class="botao-cancelar">Cancelar</button>
        <button type="button" class="botao-salvar">Salvar</button>
      </div>
    </app-form-screen>
  `,
})
class HospedeiroDeTeste {
  readonly voltou = signal(false);
}

describe('FormScreenComponent', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;

  /**
   * O sinal de celular sai de `matchMedia`, então é ele que o teste controla.
   * Trocar por um input seria testar outro componente.
   */
  function fingirLargura(ehCelular: boolean): void {
    spyOn(window, 'matchMedia').and.returnValue({
      matches: ehCelular,
      media: '(max-width: 768px)',
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => true,
    } as unknown as MediaQueryList);
  }

  async function montar(ehCelular: boolean): Promise<void> {
    fingirLargura(ehCelular);

    await TestBed.configureTestingModule({
      imports: [HospedeiroDeTeste],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();
  }

  // ── Desktop ───────────────────────────────────────────────────────────────

  it('no desktop continua ocupando a area de trabalho, e nao vira folha', async () => {
    await montar(false);

    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.form-screen')).withContext('a moldura de desktop').not.toBeNull();
    expect(raiz.querySelector('.pk-sheet')).withContext('folha nao aparece no desktop').toBeNull();
    expect(raiz.querySelector('.form-screen__title')?.textContent).toContain('Novo equipamento');
  });

  it('no desktop o corpo e as acoes chegam projetados', async () => {
    await montar(false);

    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.form-screen__body #nome')).not.toBeNull();
    expect(raiz.querySelector('.form-screen__footer .botao-salvar')).not.toBeNull();
  });

  // ── Celular ───────────────────────────────────────────────────────────────

  it('no celular sobe como folha, e nao troca de tela', async () => {
    await montar(true);

    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.pk-sheet')).withContext('a folha').not.toBeNull();
    expect(raiz.querySelector('.form-screen')).withContext('a moldura de desktop nao aparece').toBeNull();
  });

  /**
   * <b>O teste que importa.</b> Com o `<ng-content>` repetido nos dois ramos,
   * isto falha e o build continua verde — é o defeito custando um deploy.
   */
  it('na folha o formulario chega inteiro, com campo e botao de salvar', async () => {
    await montar(true);

    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('.pk-sheet__miolo #nome'))
      .withContext('o campo tem que estar DENTRO do miolo da folha')
      .not.toBeNull();
    expect(raiz.querySelector('.pk-sheet__pe .botao-salvar'))
      .withContext('sem o botao de salvar a folha e um beco sem saida')
      .not.toBeNull();
    expect(raiz.querySelector('.pk-sheet__pe .botao-cancelar')).not.toBeNull();
  });

  it('o titulo da tela vira o titulo da folha', async () => {
    await montar(true);

    expect((fixture.nativeElement as HTMLElement).querySelector('.pk-sheet__titulo')?.textContent)
      .toContain('Novo equipamento');
  });

  /**
   * Fechar a folha tem que chegar na tela dona como o mesmo `back` que o botão
   * de voltar do desktop emite — senão o cadastro fica aberto por baixo, e a
   * pessoa volta para um formulário que ela achava que tinha fechado.
   */
  it('fechar a folha avisa a tela dona, como o voltar do desktop', async () => {
    await montar(true);

    const fechar = (fixture.nativeElement as HTMLElement)
      .querySelector('.pk-sheet__fechar') as HTMLButtonElement;

    expect(fechar).not.toBeNull();
    fechar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.voltou()).toBeTrue();
  });

  /**
   * A folha é `position: fixed` e não ocupa lugar. Sem `display: contents` o
   * host continuaria sendo um item flex com `flex-grow: 1` e altura zero,
   * esticando e empurrando a lista que ficou atrás dela.
   */
  it('no celular o host sai do fluxo, para nao empurrar a lista de tras', async () => {
    await montar(true);

    expect((fixture.nativeElement as HTMLElement).querySelector('app-form-screen')?.classList)
      .toContain('em-folha');
  });
});
