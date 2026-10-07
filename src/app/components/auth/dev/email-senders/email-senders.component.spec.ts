import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EmailSendersComponent } from './email-senders.component';
import { EmailSendersService } from '../../../../infrastructure/services/email/email-senders.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { Sender, SenderRoute } from '../../../../domain/models/email/email-queue.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

const SENDERS: Sender[] = [
  { id: 'd', name: 'noreply', address: 'noreply@envios.proautokimium.com.br', displayName: 'Proauto Kimium', active: true, isDefault: true, usedBy: [] },
  { id: 'u', name: 'rh', address: 'rh@envios.proautokimium.com.br', displayName: 'RH', active: true, isDefault: false, usedBy: ['DOCUMENT_ALERT'] },
  { id: 'l', name: 'livre', address: 'livre@envios.proautokimium.com.br', displayName: 'Livre', active: true, isDefault: false, usedBy: [] },
  { id: 'i', name: 'oficina', address: 'oficina@envios.proautokimium.com.br', displayName: 'Oficina', active: false, isDefault: false, usedBy: [] },
];

const ROUTES: SenderRoute[] = [
  { origin: 'DOCUMENT_ALERT', label: 'Vencimento de documentos', hint: null, senderId: 'u', replyToId: null, last30Days: 22 },
  { origin: 'NEWSLETTER', label: 'Newsletter', hint: 'com resumo', senderId: null, replyToId: null, last30Days: 412 },
];

describe('EmailSendersComponent', () => {
  let fixture: ComponentFixture<EmailSendersComponent>;
  let comp: EmailSendersComponent;
  let service: jasmine.SpyObj<EmailSendersService>;

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    service = jasmine.createSpyObj<EmailSendersService>('EmailSendersService',
      ['list', 'create', 'update', 'makeDefault', 'routes', 'updateRoute']);
    service.list.and.returnValue(of(SENDERS));
    service.routes.and.returnValue(of(ROUTES));
    service.update.and.callFake((id: string, body: { active?: boolean }) =>
      of({ ...SENDERS.find(s => s.id === id)!, ...body }));
    service.updateRoute.and.callFake((origin, senderId, replyToId) =>
      of({ ...ROUTES.find(r => r.origin === origin)!, senderId, replyToId }));
    service.create.and.callFake((name: string, displayName: string) =>
      of({ id: 'n', name, displayName, address: `${name}@envios.proautokimium.com.br`, active: true, isDefault: false, usedBy: [] }));

    await TestBed.configureTestingModule({
      imports: [EmailSendersComponent],
      providers: providersDeTeste([
        { provide: EmailSendersService, useValue: service },
        { provide: PermissionStore, useValue: { can: () => true, canByCode: () => true, canOpen: () => true } },
      ]),
    }).compileComponents();

    fixture = TestBed.createComponent(EmailSendersComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => restaurarLargura());

  function botaoDesativar(senderName: string): HTMLButtonElement | undefined {
    const linhas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.es-remetente'));
    const linha = linhas.find(l => l.textContent?.includes(`${senderName}@`));
    return Array.from(linha?.querySelectorAll('button') ?? []).find(b => b.textContent?.trim() === 'Desativar') as HTMLButtonElement | undefined;
  }

  it('Desativar fica travado no padrão e no remetente em uso, com o motivo no título', () => {
    const padrao = botaoDesativar('noreply')!;
    const usado = botaoDesativar('rh')!;
    const livre = botaoDesativar('livre')!;

    expect(padrao.disabled).toBeTrue();
    expect(padrao.title).toContain('padrão');
    expect(usado.disabled).toBeTrue();
    expect(usado.title).toContain('Troque');
    expect(livre.disabled).toBeFalse();
  });

  it('desativar um remetente em uso não chama a API', () => {
    comp.deactivate(SENDERS[1]);
    comp.deactivate(SENDERS[0]);
    expect(service.update).not.toHaveBeenCalled();

    comp.deactivate(SENDERS[2]);
    expect(service.update).toHaveBeenCalledOnceWith('l', { active: false });
  });

  it('o inativo mostra Ativar em vez de Desativar', () => {
    expect(botaoDesativar('oficina')).toBeUndefined();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Usado por 1 serviço(s): Vencimento de documentos');
  });

  it('novo remetente com nome inválido não chama a API', () => {
    comp.openNew();
    comp.newDisplay = 'Financeiro';
    comp.newName = 'fin anceiro';
    comp.createSender();
    expect(service.create).not.toHaveBeenCalled();
    expect(comp.formError()).toContain('letras');

    comp.newName = 'financeiro';
    comp.createSender();
    expect(service.create).toHaveBeenCalledOnceWith('financeiro', 'Financeiro');
  });

  it('trocar o remetente de uma rota salva na hora, e "padrão" vai como null', () => {
    comp.changeRoute(ROUTES[0], 'senderId', null);
    expect(service.updateRoute).toHaveBeenCalledOnceWith('DOCUMENT_ALERT', null, null);
  });
});
