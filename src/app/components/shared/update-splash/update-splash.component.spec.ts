import { TestBed } from '@angular/core/testing';
import { DOCUMENT, provideZonelessChangeDetection } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { UpdateSplashComponent } from './update-splash.component';

/**
 * A tela de atualização.
 *
 * O que estes testes protegem é **quando ela aparece, quando some e quando o
 * app recarrega**. Os três erram em silêncio: não aparecer devolve o susto da
 * tela piscando; não sumir depois de uma falha prende a pessoa numa tela azul
 * de um app que continua inteiro por baixo; e não recarregar deixa todo mundo
 * na versão velha com uma atualização baixada que nunca entra.
 *
 * O componente é instanciado como serviço, sem `createComponent`. Ele não tem
 * estado de template — só um `signal` e um `switch` — e criar a view exigiria o
 * `DOCUMENT` de verdade, que é justamente o que precisa ser dublado aqui.
 */
describe('UpdateSplashComponent', () => {
  let versionUpdates: Subject<VersionEvent>;
  let reload: jasmine.Spy;
  let checkForUpdate: jasmine.Spy;
  let component: UpdateSplashComponent;

  /**
   * O dublê do `document`, com o ouvinte capturado.
   *
   * Guardar o listener é o que permite disparar `visibilitychange` à mão: sem
   * isso, o gatilho que resolve o app instalado — o mais importante dos dois —
   * ficaria sem teste, porque ele não é um método que se chame.
   */
  let documentoFake: {
    location: { reload: jasmine.Spy };
    visibilityState: string;
    addEventListener: jasmine.Spy;
    removeEventListener: jasmine.Spy;
  };

  const voltarParaOApp = () => {
    const [evento, ouvinte] = documentoFake.addEventListener.calls.mostRecent().args;
    expect(evento).toBe('visibilitychange');
    ouvinte();
  };

  /**
   * `isEnabled` é o interruptor real: em desenvolvimento o service worker não é
   * registrado, e o componente tem que sair na porta sem assinar nada.
   */
  const montar = (isEnabled = true) => {
    // Reset explícito porque o `configureTestingModule` acontece dentro do
    // `it`, e não num `beforeEach`. Sem ele, o componente de um teste anterior
    // sobrevive no injector e o `fase()` chega aqui já preenchido — os testes
    // que afirmam `null` falham por causa do vizinho, não de si mesmos.
    TestBed.resetTestingModule();

    versionUpdates = new Subject<VersionEvent>();
    reload = jasmine.createSpy('reload');
    checkForUpdate = jasmine.createSpy('checkForUpdate').and.resolveTo(false);

    documentoFake = {
      location: { reload },
      visibilityState: 'visible',
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UpdateSplashComponent,
        { provide: SwUpdate, useValue: { isEnabled, versionUpdates, checkForUpdate } },
        { provide: DOCUMENT, useValue: documentoFake },
      ],
    });

    component = TestBed.inject(UpdateSplashComponent);
  };

  const evento = (type: VersionEvent['type']) =>
    versionUpdates.next({ type } as VersionEvent);

  it('não aparece enquanto não há atualização', () => {
    montar();

    expect(component.fase()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  /**
   * **O evento que o código antigo ignorava.**
   *
   * Antes, o app filtrava só `VERSION_READY` — e quando ele chega o download já
   * acabou. A espera de verdade acontece entre um evento e outro, que era
   * exatamente o pedaço em que a tela ficava muda.
   */
  it('aparece quando o download começa, sem recarregar ainda', () => {
    montar();

    evento('VERSION_DETECTED');

    expect(component.fase()).toBe('baixando');
    expect(reload).not.toHaveBeenCalled();
  });

  it('muda para instalando e recarrega quando a versão fica pronta', () => {
    montar();

    evento('VERSION_DETECTED');
    evento('VERSION_READY');

    expect(component.fase()).toBe('instalando');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  /**
   * **O teste que evita prender alguém numa tela azul.**
   *
   * Se a instalação falha, o app continua inteiro na versão atual — só a
   * atualização não aconteceu. Deixar a splash na frente transformaria uma
   * falha invisível e inofensiva numa aplicação travada.
   */
  it('some se a instalação falhar, e não recarrega', () => {
    montar();

    evento('VERSION_DETECTED');
    evento('VERSION_INSTALLATION_FAILED');

    expect(component.fase()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  /**
   * A checagem que não acha nada é a esmagadora maioria delas. Se ela mexesse
   * na tela, a splash apareceria sozinha várias vezes por dia sem que nada
   * estivesse acontecendo.
   */
  it('checagem sem versão nova não mostra nada', () => {
    montar();

    evento('NO_NEW_VERSION_DETECTED');

    expect(component.fase()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  /**
   * Em desenvolvimento o service worker não é registrado (`app.config.ts`), e
   * `versionUpdates` nunca emite. O componente tem que sair antes de assinar —
   * assinar um observable morto funcionaria por acidente, e esconderia o dia em
   * que alguém trocasse o mock por um que emite.
   */
  it('não assina nada quando o service worker está desligado', () => {
    montar(false);

    evento('VERSION_DETECTED');
    evento('VERSION_READY');

    expect(component.fase()).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  // ─── A checagem periódica ──────────────────────────────────────────────────
  //
  // O service worker do Angular só procura versão nova ao carregar a página e a
  // cada navegação. Numa SPA aberta o dia todo não acontece nem uma coisa nem
  // outra, e no app instalado na tela de início menos ainda — ele abre uma vez e
  // vive meses. Foi assim que uma correção de 24/08 continuou invisível no
  // iPhone em 01/09.

  it('pergunta ao servidor quando mandam checar', () => {
    montar();

    component.checkNow();

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  /**
   * **O gatilho que resolve o app instalado.**
   *
   * Voltar para o app é exatamente o momento em que se quer a versão de hoje —
   * e num app que nunca navega, é a única coisa que acontece com frequência.
   */
  it('pergunta de novo quando a pessoa volta para o app', () => {
    montar();

    voltarParaOApp();

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  /**
   * Com a aba escondida o timer continua correndo em segundo plano. Checar ali
   * gasta rede para um resultado que ninguém vê — e se houver versão nova, a
   * volta para o app pergunta em seguida.
   */
  it('não pergunta com a aba escondida', () => {
    montar();
    documentoFake.visibilityState = 'hidden';

    component.checkNow();
    voltarParaOApp();

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  /**
   * **Sem rede, a promessa rejeita — e isso é normal num celular.**
   *
   * Sem o `catch`, cada checagem fora de área viraria um unhandled rejection no
   * console de quem está usando o sistema, por uma falha que não é assunto
   * dele. O teste falha com um erro de verdade se alguém tirar o `catch`.
   */
  it('falha de rede na checagem não vaza', async () => {
    montar();
    checkForUpdate.and.rejectWith(new Error('offline'));

    expect(() => component.checkNow()).not.toThrow();
    await Promise.resolve();
  });

  /**
   * Em desenvolvimento o service worker não é registrado, e `checkForUpdate`
   * estouraria. O componente tem que sair antes de agendar qualquer coisa —
   * inclusive antes de pendurar o ouvinte no `document`.
   */
  it('não agenda nada com o service worker desligado', () => {
    montar(false);

    expect(documentoFake.addEventListener).not.toHaveBeenCalled();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });
});
