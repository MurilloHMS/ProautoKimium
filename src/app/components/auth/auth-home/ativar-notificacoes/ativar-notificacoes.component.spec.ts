import { TestBed } from '@angular/core/testing';
import { providersDeTeste } from '../../../../../testing/test-setup';
import { PushNotificationService, PushStatus } from '../../../../infrastructure/services/push-notification.service';
import { AtivarNotificacoesComponent, DISPENSADO_POR_DIAS } from './ativar-notificacoes.component';

/** "Ative as notificações": só quando dá para ativar com um toque, e não insiste. */
describe('AtivarNotificacoesComponent', () => {
  let push: jasmine.SpyObj<PushNotificationService>;
  let el: HTMLElement;

  async function montar(status: PushStatus) {
    push = jasmine.createSpyObj<PushNotificationService>('PushNotificationService', ['status', 'enable']);
    push.status.and.resolveTo(status);
    TestBed.configureTestingModule({
      imports: [AtivarNotificacoesComponent],
      providers: providersDeTeste([{ provide: PushNotificationService, useValue: push }]),
    });
    const fixture = TestBed.createComponent(AtivarNotificacoesComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const botao = (texto: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => (b.textContent!.trim() || b.getAttribute('aria-label')) === texto);

  it('quem ainda não ativou vê o convite', async () => {
    await montar('available');
    expect(el.textContent).toContain('Ative as notificações');
    expect(botao('Ativar')).toBeDefined();
  });

  for (const status of ['enabled', 'denied', 'unsupported'] as PushStatus[]) {
    it(`com o status "${status}" não aparece — não há o que fazer com um toque`, async () => {
      await montar(status);
      expect(el.textContent!.trim()).toBe('');
    });
  }

  it('ativou: diz que está pronto', async () => {
    const fixture = await montar('available');
    push.enable.and.resolveTo(true);

    botao('Ativar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(push.enable).toHaveBeenCalled();
    expect(el.textContent).toContain('Notificações ativadas');
  });

  it('recusou na janela do navegador: diz como liberar', async () => {
    const fixture = await montar('available');
    push.enable.and.resolveTo(false);
    push.status.and.resolveTo('denied');

    botao('Ativar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')!.textContent).toContain('libere nas configurações do site');
  });

  it('"Agora não" esconde por 30 dias, e depois volta', async () => {
    const fixture = await montar('available');
    botao('Agora não')!.click();
    fixture.detectChanges();
    expect(el.textContent!.trim()).toBe('');

    TestBed.resetTestingModule();
    await montar('available');
    expect(el.textContent!.trim()).withContext('no dia seguinte, ainda escondido').toBe('');

    TestBed.resetTestingModule();
    const antigo = Date.now() - DISPENSADO_POR_DIAS * 86_400_000;
    localStorage.setItem('pk-notificacoes-convite-dispensado-em', String(antigo));
    await montar('available');
    expect(el.textContent).withContext('depois de 30 dias').toContain('Ative as notificações');
  });
});
