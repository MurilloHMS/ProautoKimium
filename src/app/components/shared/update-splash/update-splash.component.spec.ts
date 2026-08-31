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
  let component: UpdateSplashComponent;

  /**
   * `isEnabled` é o interruptor real: em desenvolvimento o service worker não é
   * registrado, e o componente tem que sair na porta sem assinar nada.
   */
  const montar = (isEnabled = true) => {
    versionUpdates = new Subject<VersionEvent>();
    reload = jasmine.createSpy('reload');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        UpdateSplashComponent,
        { provide: SwUpdate, useValue: { isEnabled, versionUpdates } },
        { provide: DOCUMENT, useValue: { location: { reload } } },
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
});
