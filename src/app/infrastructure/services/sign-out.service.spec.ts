import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { SignOutService } from './sign-out.service';
import { ChecklistOfflineStore, PendingChecklists } from '../state/checklist-offline.store';
import { providersDeTeste } from '../../../testing/test-setup';

/** Sair: sem pendência, sai como sempre; com pendência, espera a pessoa decidir. */
describe('SignOutService', () => {
  let service: SignOutService;
  let pending: PendingChecklists[];
  let logout: jasmine.Spy;
  let sync: jasmine.Spy;
  let home: jasmine.Spy;
  const none = { waiting: 0, refused: 0, drafts: 0 };

  beforeEach(() => {
    pending = [];
    logout = jasmine.createSpy('logoutRemoto').and.returnValue(of(void 0));
    sync = jasmine.createSpy('sincronizar').and.resolveTo();
    TestBed.configureTestingModule({
      providers: providersDeTeste([
        { provide: AuthService, useValue: { logoutRemoto: logout } },
        { provide: ChecklistOfflineStore, useValue: {
          online: signal(true), sincronizar: sync, pendingItems: () => Promise.resolve(pending.shift() ?? none) } },
      ]),
    });
    service = TestBed.inject(SignOutService);
    home = spyOn(service, 'goHome');
  });

  it('sem nada pendente, sai direto: encerra a sessão no servidor e volta para o início', async () => {
    await service.signOut();
    expect(service.warning()).toBeNull();
    expect(logout).toHaveBeenCalled();
    expect(home).toHaveBeenCalled();
  });

  it('com checklist pendente, NÃO sai: abre o aviso com a contagem', async () => {
    pending = [{ waiting: 2, refused: 0, drafts: 1 }];
    await service.signOut();
    expect(service.warning()).toEqual({ waiting: 2, refused: 0, drafts: 1 });
    expect(logout).not.toHaveBeenCalled();
  });

  it('"Continuar no sistema" fecha o aviso e não sai; "Sair mesmo assim" sai', async () => {
    pending = [{ waiting: 1, refused: 0, drafts: 0 }];
    await service.signOut();
    service.stay();
    expect(service.warning()).toBeNull();
    expect(logout).not.toHaveBeenCalled();

    service.signOutAnyway();
    expect(logout).toHaveBeenCalled();
    expect(home).toHaveBeenCalled();
  });

  it('"Enviar agora" que esvazia a fila sai sozinho', async () => {
    pending = [{ waiting: 1, refused: 0, drafts: 0 }];
    await service.signOut();
    await service.sendNow();
    expect(sync).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });

  it('"Enviar agora" que não resolve tudo atualiza o aviso e continua esperando', async () => {
    pending = [{ waiting: 2, refused: 0, drafts: 1 }, { waiting: 0, refused: 0, drafts: 1 }];
    await service.signOut();
    await service.sendNow();
    expect(service.warning()).toEqual({ waiting: 0, refused: 0, drafts: 1 });
    expect(service.sending()).toBeFalse();
    expect(logout).not.toHaveBeenCalled();
  });
});
