import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EmailQueueComponent } from './email-queue.component';
import { EmailQueueService } from '../../../../infrastructure/services/email/email-queue.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { EmailDetail, EmailRow, EmailSummary } from '../../../../domain/models/email/email-queue.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

function row(over: Partial<EmailRow> = {}): EmailRow {
  return {
    id: 'e1', to: 'ana@x.com', subject: 'Assunto', origin: 'NEWSLETTER', originLabel: 'Newsletter',
    status: 'SENT', attempts: 1, createdAt: '2026-10-07T10:00:00', sentAt: '2026-10-07T10:00:20',
    lastAttemptAt: '2026-10-07T10:00:20', lastError: null, failureKind: null, failureLabel: null, hasAttachments: false,
    resendable: (over.status ?? 'SENT') === 'FAILED',
    ...over,
  };
}

const SUMMARY: EmailSummary = {
  days: 7, failed: 2, queued: 1, oldestQueuedAt: null, sent: 10, successRate: 83.3, retried: 1, avgAttempts: 1.2,
  lastActivityAt: '2026-10-07T17:42:00', perDay: [], reasons: [], origins: [],
};

const ROWS = [
  row({ id: 'f1', to: 'joao@x.com', status: 'FAILED', attempts: 5, failureKind: 'MAILBOX_NOT_FOUND', failureLabel: 'Caixa postal não existe', lastError: '550 5.1.1' }),
  row({ id: 'f2', to: 'bia@x.com', status: 'FAILED', attempts: 5, failureKind: 'TIMEOUT', failureLabel: 'Tempo esgotado' }),
  row({ id: 's1', to: 'ana@x.com', status: 'SENT' }),
  row({ id: 'p1', to: 'caio@x.com', status: 'PENDING', attempts: 0, sentAt: null }),
];

describe('EmailQueueComponent', () => {
  let fixture: ComponentFixture<EmailQueueComponent>;
  let comp: EmailQueueComponent;
  let service: jasmine.SpyObj<EmailQueueService>;

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    service = jasmine.createSpyObj<EmailQueueService>('EmailQueueService', ['list', 'summary', 'get', 'resend', 'resendMany']);
    service.list.and.returnValue(of({ total: ROWS.length, items: ROWS }));
    service.summary.and.returnValue(of(SUMMARY));
    service.get.and.callFake((id: string) => of({
      ...ROWS.find(r => r.id === id)!, from: 'noreply@envios.proautokimium.com.br', fromName: 'Proauto Kimium',
      replyTo: null, body: '<p>Olá</p>', bodyHidden: false, attachments: [],
    } as EmailDetail));
    service.resend.and.returnValue(of(row({ id: 'f1', status: 'PENDING', attempts: 0 })));
    service.resendMany.and.returnValue(of({ requeued: 2 }));

    await TestBed.configureTestingModule({
      imports: [EmailQueueComponent],
      providers: providersDeTeste([
        { provide: EmailQueueService, useValue: service },
        { provide: PermissionStore, useValue: { can: () => true, canByCode: () => true, canOpen: () => true } },
      ]),
    }).compileComponents();

    fixture = TestBed.createComponent(EmailQueueComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => restaurarLargura());

  it('reenviar pela ficha só chama a API depois de confirmar', () => {
    comp.open(ROWS[0], true);
    fixture.detectChanges();

    expect(comp.confirmResend()).toBeTrue();
    expect(service.resend).not.toHaveBeenCalled();

    comp.resendOpened();
    expect(service.resend).toHaveBeenCalledOnceWith('f1');
    expect(comp.openedRow()).toBeNull();
  });

  it('o botão Reenviar da ficha pede confirmação em vez de reenviar', () => {
    comp.open(ROWS[1]);
    fixture.detectChanges();
    expect(comp.confirmResend()).toBeFalse();

    comp.askResend();
    fixture.detectChanges();
    expect(service.resend).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Voltar este e-mail para a fila');
  });

  it('avisa que reenviar erro de endereço vai falhar de novo', () => {
    comp.open(ROWS[0], true);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('reenviar sem corrigir o cadastro vai falhar de novo');
  });

  it('e-mail com código de acesso que falhou não tem Reenviar, nem na linha nem na ficha', async () => {
    const codigo = row({ id: 'r1', status: 'FAILED', attempts: 1, origin: 'PASSWORD_RESET', resendable: false });
    service.list.and.returnValue(of({ total: 1, items: [codigo] }));
    service.get.and.returnValue(of({ ...codigo, from: 'noreply@envios.proautokimium.com.br', fromName: 'Proauto Kimium',
      replyTo: null, body: null, bodyHidden: true, attachments: [] } as EmailDetail));
    fixture = TestBed.createComponent(EmailQueueComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tbody input[type=checkbox]')).toBeNull();
    expect(Array.from(el.querySelectorAll('button.eq-acao')).some(b => b.textContent?.includes('Reenviar'))).toBeFalse();

    comp.open(codigo, true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(comp.confirmResend()).toBeFalse();
    expect(document.body.textContent).toContain('Não se reenvia');
  });

  it('não reenvia o que não falhou', () => {
    comp.open(ROWS[2], true);
    expect(comp.confirmResend()).toBeFalse();
    comp.resendOpened();
    expect(service.resend).not.toHaveBeenCalled();
  });

  it('só as linhas que falharam têm caixa de seleção', () => {
    const el = fixture.nativeElement as HTMLElement;
    const caixas = el.querySelectorAll('tbody input[type="checkbox"]');
    expect(caixas.length).toBe(2);
  });

  it('selecionar todos pega só os FAILED, e o lote confirma antes de chamar a API', () => {
    comp.toggleAll(true);
    comp.toggleSelect(ROWS[2], true);   // enviado: ignorado
    comp.toggleSelect(ROWS[3], true);   // na fila: ignorado
    expect(comp.selectedIds()).toEqual(['f1', 'f2']);

    comp.bulkConfirm.set(true);
    fixture.detectChanges();
    expect(service.resendMany).not.toHaveBeenCalled();

    comp.resendSelected();
    expect(service.resendMany).toHaveBeenCalledOnceWith(['f1', 'f2']);
    expect(comp.selectedIds()).toEqual([]);
  });

  it('o motivo de erro filtra a página carregada na tela', () => {
    comp.toggleReason({ kind: 'TIMEOUT', label: 'Tempo esgotado', count: 1, sample: null });
    expect(comp.status()).toBe('FAILED');
    expect(service.list).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'FAILED' }));
    expect(comp.visibleRows().map(r => r.id)).toEqual(['f2']);
  });

  it('período sem envio concluído diz isso, em vez de 100% de sucesso', async () => {
    service.summary.and.returnValue(of({ ...SUMMARY, sent: 0, failed: 0, successRate: null }));
    fixture = TestBed.createComponent(EmailQueueComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent!;
    expect(texto).toContain('nenhum envio no período');
    expect(texto).not.toContain('% de sucesso');
  });

  it('a faixa do agendador mostra a última atividade', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('última atividade às 17:42');
  });
});
