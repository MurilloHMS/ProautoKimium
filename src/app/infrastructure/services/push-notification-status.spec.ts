import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { providersDeTeste } from '../../../testing/test-setup';
import { PushNotificationService } from './push-notification.service';

/** O que o alerta da home pergunta: dá para ativar com um toque, aqui? */
describe('PushNotificationService · status', () => {
  let subscription: BehaviorSubject<PushSubscription | null>;

  function servico(swLigado: boolean, permissao: NotificationPermission): PushNotificationService {
    subscription = new BehaviorSubject<PushSubscription | null>(null);
    const sw = { isEnabled: swLigado, subscription, notificationClicks: new BehaviorSubject(null) };
    TestBed.configureTestingModule({ providers: providersDeTeste([{ provide: SwPush, useValue: sw }]) });
    spyOnProperty(Notification, 'permission', 'get').and.returnValue(permissao);
    return TestBed.inject(PushNotificationService);
  }

  it('sem service worker (dev, ou iPhone fora do app instalado): sem suporte', async () => {
    expect(await servico(false, 'default').status()).toBe('unsupported');
  });

  it('nunca perguntado: dá para ativar', async () => {
    expect(await servico(true, 'default').status()).toBe('available');
  });

  it('bloqueado pela pessoa: o site não pode perguntar de novo', async () => {
    expect(await servico(true, 'denied').status()).toBe('denied');
  });

  it('permitido E inscrito: já recebe', async () => {
    const s = servico(true, 'granted');
    subscription.next({} as PushSubscription);
    expect(await s.status()).toBe('enabled');
  });

  it('permitido mas sem inscrição (trocou de aparelho, limpou dados): ainda dá para ativar', async () => {
    expect(await servico(true, 'granted').status()).toBe('available');
  });
});
