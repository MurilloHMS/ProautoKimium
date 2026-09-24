import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CamadaVoltavel, MARCA_DE_CAMADA, camadaVoltavel } from './camada-voltavel';

import { providersDeTeste } from '../../../testing/test-setup';

/**
 * **O voltar do aparelho tem de fechar a camada, não sair da tela.**
 *
 * Nada aqui navega de verdade: `pushState` e `back` são espiados, e o voltar do
 * navegador entra como um `popstate` sintético. Não é preguiça — o Karma roda
 * num iframe cujo histórico é o mesmo da página que o hospeda, então um
 * `history.back()` de verdade num teste que falha no meio pode levar o
 * **runner** junto.
 */
describe('camadaVoltavel', () => {

  let aoVoltar: jasmine.Spy;
  let empilhou: jasmine.Spy;
  let voltou: jasmine.Spy;
  let injector: EnvironmentInjector;
  let camada: CamadaVoltavel;
  let vivo: boolean;

  /** O voltar do aparelho: caímos numa entrada que não é nossa. */
  function voltarDoAparelho(state: unknown = { navigationId: 1 }): void {
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: providersDeTeste() });

    empilhou = spyOn(window.history, 'pushState');
    voltou = spyOn(window.history, 'back');
    aoVoltar = jasmine.createSpy('aoVoltar');

    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    camada = runInInjectionContext(injector, () => camadaVoltavel(aoVoltar));
    vivo = true;
  });

  // Sem isto o listener de cada teste fica pendurado no `window` e o do teste
  // seguinte dispara junto: o spy de `back` contava 6 chamadas numa só.
  afterEach(() => {
    if (vivo) injector.destroy();
  });

  it('empilha uma entrada marcada, sem mexer na URL', () => {
    camada.empilhar();

    expect(empilhou).toHaveBeenCalledTimes(1);

    const [estado, , url] = empilhou.calls.mostRecent().args;
    expect(estado[MARCA_DE_CAMADA]).withContext('a marca').toBeTrue();
    expect(url).withContext('a URL não muda').toBe(location.href);
  });

  it('preserva o estado que o Router já tinha posto na entrada', () => {
    // Sem isto o `navigationId` do Angular some e o Router se perde ao voltar.
    history.replaceState({ navigationId: 7 }, '');

    camada.empilhar();

    expect(empilhou.calls.mostRecent().args[0].navigationId).toBe(7);
  });

  it('o voltar do aparelho, com entrada nossa, avisa quem abriu', () => {
    camada.empilhar();

    voltarDoAparelho();

    expect(aoVoltar).toHaveBeenCalledTimes(1);
  });

  it('o voltar do aparelho SEM entrada nossa não avisa ninguém', () => {
    // A pessoa está só navegando pelo app. Fechar uma camada que não existe
    // seria roubar o voltar de quem nunca pediu.
    voltarDoAparelho();

    expect(aoVoltar).not.toHaveBeenCalled();
  });

  it('a mesma entrada não avisa duas vezes', () => {
    camada.empilhar();

    voltarDoAparelho();
    voltarDoAparelho();

    expect(aoVoltar).toHaveBeenCalledTimes(1);
  });

  it('cair numa marca órfã engole a entrada em vez de fechar camada', () => {
    // Órfã = a pessoa saiu da gaveta navegando, e a marca ficou enterrada no
    // histórico. Sem engolir, sobra um "voltar" que não faz nada visível.
    voltarDoAparelho({ navigationId: 3, [MARCA_DE_CAMADA]: true });

    expect(voltou).withContext('engoliu').toHaveBeenCalledTimes(1);
    expect(aoVoltar).withContext('não é para fechar nada').not.toHaveBeenCalled();
  });

  it('voltar() com entrada nossa pede o voltar ao navegador', () => {
    camada.empilhar();

    camada.voltar();

    expect(voltou).toHaveBeenCalledTimes(1);
    // Quem fecha é o `popstate` que vem depois — assim o X e o voltar do
    // aparelho seguem o MESMO caminho, e não dois que precisam concordar.
    expect(aoVoltar).not.toHaveBeenCalled();
  });

  it('voltar() sem entrada nossa fecha na hora', () => {
    camada.voltar();

    expect(voltou).not.toHaveBeenCalled();
    expect(aoVoltar).toHaveBeenCalledTimes(1);
  });

  it('destruído, solta o listener', () => {
    camada.empilhar();

    injector.destroy();
    vivo = false;

    voltarDoAparelho();

    expect(aoVoltar).not.toHaveBeenCalled();
  });
});
