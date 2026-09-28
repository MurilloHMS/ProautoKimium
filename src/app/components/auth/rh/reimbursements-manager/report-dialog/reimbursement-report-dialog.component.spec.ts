import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentRef, signal } from '@angular/core';
import { ReimbursementReportDialogComponent } from './reimbursement-report-dialog.component';
import { reportParams } from '../../../../../infrastructure/services/hr/reimbursement.service';
import { PermissionStore } from '../../../../../infrastructure/state/permission.store';
import { EmployeeStore } from '../../../../../infrastructure/state/employee.store';
import { environment } from '../../../../../../environments/environment';
import {
  NO_COMPUTADOR,
  larguraDaJanela,
  providersDeTeste,
  restaurarLargura,
} from '../../../../../../testing/test-setup';

const API = environment.apiUrl;
const RECIPIENTS = `${API}/hr/report-recipients`;
const REPORT = `${API}/hr/reimbursements/report`;

describe('ReimbursementReportDialogComponent', () => {
  let fixture: ComponentFixture<ReimbursementReportDialogComponent>;
  let ref: ComponentRef<ReimbursementReportDialogComponent>;
  let component: ReimbursementReportDialogComponent;
  let http: HttpTestingController;

  /** Os três verbos da tela: baixar, enviar e configurar os destinatários. */
  const TUDO = { 'rh/reimbursements': ['CONSULTAR', 'BAIXAR', 'ENVIAR', 'CONFIGURAR'] };

  beforeEach(() => {
    // 15/09/2026: os atalhos de período dependem de "hoje".
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 15, 10, 0));
    larguraDaJanela(NO_COMPUTADOR);

    TestBed.configureTestingModule({
      imports: [ReimbursementReportDialogComponent],
      providers: providersDeTeste([
        {
          provide: EmployeeStore,
          useValue: {
            options: signal([{ label: 'Ana Beatriz Rocha', value: 'ana-id' }]),
            load: () => undefined,
          },
        },
      ]),
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReimbursementReportDialogComponent);
    ref = fixture.componentRef;
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    restaurarLargura();
    http.verify();
  });

  function permissoes(mapa: Record<string, string[]>): void {
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(`${API}/me/permissions`).flush(mapa);
  }

  async function abrir(destinatarios: { id: string; email: string }[] = [
    { id: '1', email: 'rh@proautokimium.com.br' },
  ]): Promise<void> {
    permissoes(TUDO);
    ref.setInput('open', true);
    fixture.detectChanges();
    http.expectOne(RECIPIENTS).flush(destinatarios.map(d => ({ ...d, createdAt: '2026-09-28T10:00:00', createdBy: 'carla.rh' })));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function texto(): string {
    return document.body.textContent?.replace(/\s+/g, ' ') ?? '';
  }

  function botao(rotulo: string): HTMLButtonElement {
    const all = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
    const found = all.find(b => b.textContent?.replace(/\s+/g, ' ').trim() === rotulo);
    if (!found) throw new Error(`Botão "${rotulo}" não encontrado`);
    return found;
  }

  // ─── período ─────────────────────────────────────────────────────────────

  it('abre no mês corrente, pela data da despesa', async () => {
    await abrir();
    expect(component.filter().from).toBe('2026-09-01');
    expect(component.filter().to).toBe('2026-09-30');
  });

  it('atalhos: mês passado e últimos 3 meses fecham no último dia do mês', () => {
    component.applyPreset('last');
    expect(component.filter().from).toBe('2026-08-01');
    expect(component.filter().to).toBe('2026-08-31');

    component.applyPreset('three');
    expect(component.filter().from).toBe('2026-07-01');
    expect(component.filter().to).toBe('2026-09-30');
  });

  /** O atalho aceso mentiria sobre o período depois de a data mudar à mão. */
  it('editar a data à mão apaga o atalho aceso', () => {
    component.onDateEdited();
    expect(component.preset()).toBeNull();
  });

  // ─── status e validação ──────────────────────────────────────────────────

  it('começa com Pendente, Aprovado e Pago — Recusado fora', () => {
    expect(component.statuses).toEqual(['PENDING', 'APPROVED', 'PAID']);
  });

  it('sem status nenhum, diz o motivo e desliga os dois botões', async () => {
    await abrir();
    component.selected = { PENDING: false, APPROVED: false, PAID: false, REJECTED: false };
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texto()).toContain('Escolha pelo menos um status.');
    expect(botao('Baixar PDF').disabled).toBeTrue();
    expect(botao('Enviar ao RH').disabled).toBeTrue();
  });

  it('fim antes do início também desliga, com o motivo', () => {
    component.from = new Date(2026, 8, 30);
    component.to = new Date(2026, 8, 1);
    expect(component.invalidReason).toBe('O fim do período não pode ser antes do início.');
  });

  // ─── parâmetros ──────────────────────────────────────────────────────────

  /** É assim que o Spring monta a List<ReimbursementStatus>. */
  it('status vai repetido, e funcionário só quando escolhido', () => {
    const todos = reportParams({ from: '2026-09-01', to: '2026-09-30', statuses: ['PAID', 'APPROVED'], employeeId: null });
    expect(todos.getAll('status')).toEqual(['PAID', 'APPROVED']);
    expect(todos.has('employeeId')).toBeFalse();

    const um = reportParams({ from: '2026-09-01', to: '2026-09-30', statuses: ['PAID'], employeeId: 'ana-id' });
    expect(um.get('employeeId')).toBe('ana-id');
  });

  // ─── baixar ──────────────────────────────────────────────────────────────

  /**
   * O erro de pedido de arquivo chega como Blob. Sem ler o Blob, a tela
   * mostraria o texto genérico no lugar da explicação da API.
   */
  it('recusa da API ao baixar mostra a mensagem dela, lida de dentro do Blob', async () => {
    await abrir();
    component.download();
    const req = http.expectOne(r => r.url === REPORT);
    expect(req.request.params.get('from')).toBe('2026-09-01');
    req.flush(new Blob([JSON.stringify({ message: 'Nenhuma solicitação de reembolso encontrada com esses filtros' })],
      { type: 'application/json' }), { status: 404, statusText: 'Not Found' });

    await jasmineWait(() => component.error() !== null);
    expect(component.error()).toBe('Nenhuma solicitação de reembolso encontrada com esses filtros');
  });

  // ─── enviar ──────────────────────────────────────────────────────────────

  it('mostra para quem saiu e para quem não saiu', async () => {
    await abrir([{ id: '1', email: 'rh@proautokimium.com.br' }, { id: '2', email: 'financeiro@x.com' }]);
    component.send();
    const req = http.expectOne(r => r.url === `${REPORT}/email`);
    expect(req.request.method).toBe('POST');
    req.flush({ fileName: 'c.pdf', sentTo: ['rh@proautokimium.com.br'], failed: ['financeiro@x.com'] });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texto()).toContain('Enviado para 1 de 2 endereços');
    expect(texto()).toContain('financeiro@x.com');
    expect(botao('Enviar de novo')).toBeTruthy();
  });

  it('sem e-mail do RH cadastrado, não deixa enviar e diz por quê', async () => {
    await abrir([]);

    expect(texto()).toContain('Nenhum e-mail do RH cadastrado');
    expect(botao('Enviar ao RH').disabled).toBeTrue();
    expect(botao('Baixar PDF').disabled).toBeFalse();
  });

  // ─── permissões ──────────────────────────────────────────────────────────

  /** Botão visível com endpoint negado vira 403 na cara de quem clicou. */
  it('quem só baixa não vê o envio nem a edição dos destinatários', async () => {
    permissoes({ 'rh/reimbursements': ['CONSULTAR', 'BAIXAR'] });
    ref.setInput('open', true);
    fixture.detectChanges();
    http.expectOne(RECIPIENTS).flush([]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texto()).toContain('Baixar PDF');
    expect(texto()).not.toContain('Enviar ao RH');
    expect(texto()).not.toContain('Cadastrar e-mail do RH');
  });

  // ─── destinatários ───────────────────────────────────────────────────────

  it('e-mail repetido volta com a mensagem da API, no lugar', async () => {
    await abrir();
    component.mode.set('recipients');
    component.newEmail = 'RH@proautokimium.com.br';
    component.addRecipient();
    http.expectOne(r => r.url === RECIPIENTS && r.method === 'POST')
      .flush({ message: 'Este e-mail já recebe os relatórios do RH' }, { status: 409, statusText: 'Conflict' });

    await jasmineWait(() => component.recipientError() !== null);
    expect(component.recipientError()).toBe('Este e-mail já recebe os relatórios do RH');
  });

  /**
   * Espera o `await` dentro do callback de erro: ler um Blob é assíncrono de
   * verdade. Com o `jasmine.clock()` instalado o `setTimeout` é falso e nunca
   * dispara — o MessageChannel é uma tarefa real que o relógio falso não pega.
   */
  async function jasmineWait(pronto: () => boolean): Promise<void> {
    for (let i = 0; i < 50 && !pronto(); i++) {
      await new Promise<void>(resolve => {
        const canal = new MessageChannel();
        canal.port1.onmessage = () => resolve();
        canal.port2.postMessage(null);
      });
    }
  }
});
