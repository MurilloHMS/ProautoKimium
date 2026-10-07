import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EmailQueueComponent } from './email-queue.component';
import { EmailQueueService } from '../../../../infrastructure/services/email/email-queue.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { EmailDetail, EmailInsights, EmailRow, EmailSummary } from '../../../../domain/models/email/email-queue.model';
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

const INSIGHTS: EmailInsights = {
  current: { failed: 12, sent: 1212, retried: 21, bounced: 6, deliveryRate: 98.0 },
  previous: { failed: 7, sent: 1120, retried: 12, bounced: 8, deliveryRate: 97.9 },
  funnel: { created: 1240, sent: 1212, delivered: 1188, queued: 16, failed: 12, bounced: 6, unconfirmed: 18 },
  toSend: { count: 10, medianSeconds: 42, p95Seconds: 190, edges: [15, 30, 60, 120, 300, 900], buckets: [2, 1, 3, 1, 1, 1, 1] },
  toDeliver: { count: 0, medianSeconds: null, p95Seconds: null, edges: [1, 2, 5, 10, 30, 60], buckets: [0, 0, 0, 0, 0, 0, 0] },
  origins: [{ origin: 'NEWSLETTER', label: 'Newsletter', total: 412, failed: 2, deliveryRate: 93.1, medianToSendSeconds: 360 }],
  domains: [{ domain: 'hotmail.com', total: 176, deliveryRate: 93.2, bounced: 4 }],
  problemAddresses: [{ address: 'joao@hotmial.com', times: 4, lastKind: 'INVALID_ADDRESS', lastLabel: 'Endereço inválido', origin: 'NEWSLETTER', originLabel: 'Newsletter' }],
  perHour: Array.from({ length: 24 }, (_, h) => (h === 8 ? 100 : h === 6 ? 55 : 0)),
  tracking: { enabled: true, awaiting: 16, unconfirmed: 2, lastRunAt: '2026-10-07T15:20:00', lastRunOk: true, lastRunPages: 1, lastRunError: null },
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
    service = jasmine.createSpyObj<EmailQueueService>('EmailQueueService', ['list', 'summary', 'insights', 'get', 'resend', 'resendMany']);
    service.insights.and.returnValue(of(INSIGHTS));
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

  it('o período de cima manda também na lista: 90 dias recarrega os dois com o mesmo período', () => {
    service.list.calls.reset();
    service.summary.calls.reset();

    comp.setPeriod(90);

    expect(service.summary).toHaveBeenCalledWith({ days: 90 });
    expect(service.list).toHaveBeenCalledWith(jasmine.objectContaining({ days: 90 }));
  });

  it('"Desde…" só carrega quando a data é escolhida, e a data vai para os dois', () => {
    service.list.calls.reset();
    service.summary.calls.reset();

    comp.setPeriod('since');
    expect(service.list).not.toHaveBeenCalled();

    comp.setSince(comp.today);
    expect(service.summary).toHaveBeenCalledWith({ since: comp.today });
    expect(service.list).toHaveBeenCalledWith(jasmine.objectContaining({ since: comp.today }));
  });

  it('passar o mouse numa barra do gráfico mostra os números do dia', async () => {
    service.summary.and.returnValue(of({ ...SUMMARY, perDay: [
      { date: '2026-10-06', sent: 4, failed: 0, retried: 0 },
      { date: '2026-10-07', sent: 12, failed: 3, retried: 2 },
    ] }));
    comp.refresh();
    fixture.detectChanges();

    const barras = (fixture.nativeElement as HTMLElement).querySelectorAll('.eq-grafico__barra');
    barras[1].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const dica = (fixture.nativeElement as HTMLElement).querySelector('.eq-dica-grafico')!;
    expect(dica.textContent).toContain('07/10');
    expect(dica.textContent).toContain('12 enviado(s)');
    expect(dica.textContent).toContain('3 falharam');
    expect(dica.textContent).toContain('2 precisaram insistir');
  });

  it('a taxa de entrega aparece com o que ainda espera confirmação', async () => {
    service.summary.and.returnValue(of({ ...SUMMARY, delivery: { tracked: 40, delivered: 37, bounced: 1, awaiting: 2, rate: 92.5 } }));
    comp.refresh();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent!;
    expect(texto).toContain('92,5%');
    expect(texto).toContain('37 de 40 chegaram ao destinatário');
    expect(texto).toContain('2 sem confirmação');
    const devolvidos = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.eq-kpi'))
      .find(k => k.textContent!.includes('Devolvidos'))!;
    expect(devolvidos.querySelector('b')!.textContent).toBe('1');
  });

  describe('o e-mail na ficha não rola por dentro', () => {
    async function iframeCom(html: string, largura: number): Promise<HTMLIFrameElement> {
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-same-origin');
      f.style.width = `${largura}px`;
      f.style.height = '360px';
      f.style.border = '1px solid #ccc';
      f.style.boxSizing = 'border-box';
      // Num pai comum: o body do tema é flex em coluna e espremeria o iframe.
      const pai = document.createElement('div');
      pai.appendChild(f);
      document.body.appendChild(pai);
      await new Promise<void>(ok => { f.onload = () => ok(); f.srcdoc = html; });
      return f;
    }

    it('cresce até a altura do e-mail: nem barra vertical, nem a horizontal que ela criava', async () => {
      const f = await iframeCom('<table width="100%" style="max-width:600px"><tr><td style="height:1100px">alto</td></tr></table>', 360);
      comp.fitBody(f);
      const de = f.contentDocument!.documentElement;
      expect(f.offsetHeight).toBeGreaterThanOrEqual(1100);
      expect(de.scrollHeight).toBeLessThanOrEqual(de.clientHeight + 1);
      expect(de.scrollWidth).toBeLessThanOrEqual(de.clientWidth);
      f.parentElement!.remove();
    });

    it('e-mail antigo de 600px fixos: depois de encolher, o espaço da direita é igual ao da esquerda', async () => {
      // A estrutura do template de vencimento de documentos de antes da fase 1:
      // moldura com 10px de cada lado e o cartão de 600px fixos, que transborda à direita.
      const f = await iframeCom(`<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="padding:30px 10px"><table id="cartao" width="600" cellpadding="0" cellspacing="0"
        style="background:#232e61"><tr><td style="height:80px">cartão</td></tr></table></td></tr></table>`, 590);
      comp.fitBody(f);
      const doc = f.contentDocument!;
      const r = doc.getElementById('cartao')!.getBoundingClientRect();
      // O Chrome já devolve o retângulo com o zoom aplicado.
      const esquerda = r.left, direita = doc.documentElement.clientWidth - r.right;
      expect(esquerda).toBeGreaterThan(5);
      expect(Math.abs(esquerda - direita)).withContext(`esquerda ${esquerda.toFixed(1)} · direita ${direita.toFixed(1)}`).toBeLessThan(1.5);
      f.parentElement!.remove();
    });

    it('a barra de rolagem da ficha aparece DEPOIS do ajuste (Windows): o e-mail reajusta e não fica cortado', async () => {
      const antigo = `<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="padding:30px 10px"><table id="cartao" width="600" cellpadding="0" cellspacing="0"
        style="background:#c0392b"><tr><td style="height:80px">cartão</td></tr></table></td></tr></table>`;
      const f = await iframeCom(antigo, 640);
      comp.fitBody(f);
      // O iframe cresceu, a ficha ganhou barra de 17px, e ele ficou mais estreito.
      f.style.width = '573px';
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
      const doc = f.contentDocument!;
      const r = doc.getElementById('cartao')!.getBoundingClientRect();
      expect(r.right).withContext('o cartão termina dentro da caixa').toBeLessThanOrEqual(doc.documentElement.clientWidth);
      expect(Math.abs(r.left - (doc.documentElement.clientWidth - r.right))).toBeLessThan(1.5);
      f.parentElement!.remove();
    });

    it('e-mail antigo mais largo que a ficha encolhe para caber, em vez de rolar para o lado', async () => {
      const f = await iframeCom('<table width="640" style="width:640px"><tr><td>largo</td></tr></table>', 360);
      comp.fitBody(f);
      const doc = f.contentDocument!;
      const zoom = doc.body.style.getPropertyValue('zoom');
      expect(zoom).withContext('sem zoom, Number("") daria 0 e passaria').not.toBe('');
      expect(Number(zoom)).toBeLessThan(1);
      expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(doc.documentElement.clientWidth);
      f.parentElement!.remove();
    });
  });

  describe('análise (blocos A a H)', () => {
    const texto = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

    it('A: falhas subindo é seta vermelha; devolvidos caindo é verde; taxa em pontos percentuais', () => {
      const setas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.eq-kpis .eq-seta'));
      const falhas = setas.find(s => s.closest('.eq-kpi')!.textContent!.includes('Falharam'))!;
      const devolvidos = setas.find(s => s.closest('.eq-kpi')!.textContent!.includes('Devolvidos'))!;
      expect(falhas.textContent!.trim()).toBe('▲ 5');
      expect(falhas.classList).toContain('is-bad');
      expect(devolvidos.textContent!.trim()).toBe('▼ 2');
      expect(devolvidos.classList).toContain('is-good');
      expect(texto()).toContain('▲ 0,1 p.p.');
    });

    it('B, C, D, E, G e H aparecem com os números da API', () => {
      const t = texto();
      expect(t).toContain('Do pedido à caixa de entrada');
      expect(t).toContain('1188');
      expect(t).toContain('18 sem confirmação');
      expect(t).toContain('42 s · 95% até 3 min');
      expect(t).toContain('sem dados no período');
      expect(t).toContain('hotmail.com');
      expect(t).toContain('pico às 8h (100)');
      expect(t).toContain('enviados sem confirmação de entrega · 2 passaram dos 3 dias');
      expect((fixture.nativeElement as HTMLElement).querySelector('.eq-taxa.is-baixa')).withContext('93,1% fica amarelo').not.toBeNull();
    });

    it('F: "Ver os 4" filtra a lista por aquele endereço', () => {
      service.list.calls.reset();
      const botao = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
        .find(b => b.textContent!.includes('Ver os 4')) as HTMLButtonElement;
      botao.click();
      expect(service.list).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'joao@hotmial.com', status: null }));
    });

    it('G: sem o token, a tela diz que o rastreio está desligado', () => {
      service.insights.and.returnValue(of({ ...INSIGHTS, tracking: { ...INSIGHTS.tracking, enabled: false } }));
      comp.refresh();
      fixture.detectChanges();
      expect(texto()).toContain('Desligado: falta o SMTP_API_TOKEN');
    });

    it('o período vai também para a análise', () => {
      service.insights.calls.reset();
      comp.setPeriod(30);
      expect(service.insights).toHaveBeenCalledWith({ days: 30 });
    });
  });
});
