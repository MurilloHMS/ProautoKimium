import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HrReimbursementsComponent } from './hr-reimbursements.component';
import { Reimbursement, ReimbursementSummary } from '../../../domain/models/hr/reimbursement.model';
import { environment } from '../../../../environments/environment';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/reimbursements`;

const VAZIO: ReimbursementSummary = {
  month: '2026-09',
  sent: { amount: 0, count: 0 }, pending: { amount: 0, count: 0 },
  approved: { amount: 0, count: 0 }, paid: { amount: 0, count: 0 },
  contestedPending: 0,
};

function pedido(extra: Partial<Reimbursement> = {}): Reimbursement {
  return {
    id: 'r1', employeeId: 'e1', expenseDate: '2026-09-03', amount: 320, category: 'Hospedagem',
    reason: 'Pernoite', receiptOriginalFilename: 'foto.jpg', status: 'PENDING',
    requestedAt: '2026-09-04T09:00:00', reviewedById: null, reviewedAt: null, reviewNotes: null,
    paymentDate: null, paidAt: null, contestedAt: null, contestComment: null, originalReceiptFilename: null,
    firstReviewedById: null, firstReviewedAt: null, firstReviewNotes: null, contestDeadline: null,
    ...extra,
  };
}

describe('HrReimbursementsComponent', () => {
  let component: HrReimbursementsComponent;
  let fixture: ComponentFixture<HrReimbursementsComponent>;
  let http: HttpTestingController;

  /** Responde a carga da tela: a lista e os totais do mês. */
  function responderCarga(lista: Reimbursement[] = [], totais: ReimbursementSummary = VAZIO): void {
    http.expectOne(`${API}/me`).flush(lista);
    http.expectOne(r => r.url === `${API}/me/summary`).flush(totais);
  }

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    await TestBed.configureTestingModule({
      imports: [HrReimbursementsComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(HrReimbursementsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    component.month.set('2026-09');
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    restaurarLargura();
  });

  function preencher(amount: string): void {
    component.form.patchValue({
      expenseDate: new Date(2026, 8, 20),
      amount,
      category: 'Restaurante',
      reason: 'Almoço com cliente',
    });
    component.selectedReceipt = new File(['%PDF-1.7'], 'nota.pdf', { type: 'application/pdf' });
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  // ─── o valor (a máscara de maquininha) ───────────────────────────────────

  /**
   * O campo era `type="number"`, que no teclado brasileiro recusa a vírgula.
   * Agora é a máscara de maquininha: os dígitos preenchem as casas da direita
   * para a esquerda, e o que chega ao formulário é o texto mascarado.
   */
  it('manda o valor como número, e não o texto com vírgula', () => {
    responderCarga();
    preencher('1.234,56');

    component.enviar();

    const req = http.expectOne(API);
    expect((req.request.body as FormData).get('amount')).toBe('1234.56');
    req.flush({});
    responderCarga();
  });

  it('centavos sozinhos continuam valendo', () => {
    responderCarga();
    preencher('0,37');

    component.enviar();

    const req = http.expectOne(API);
    expect((req.request.body as FormData).get('amount')).toBe('0.37');
    req.flush({});
    responderCarga();
  });

  it('valor zerado não passa: o botão fica desligado', () => {
    responderCarga();
    preencher('0,00');

    expect(component.podeEnviar).toBeFalse();
    component.enviar();
    http.expectNone(API);
  });

  it('sem valor não passa', () => {
    responderCarga();
    preencher('');
    expect(component.podeEnviar).toBeFalse();
  });

  // ─── o formulário sob demanda ────────────────────────────────────────────

  /** O formulário que ficava sempre aberto virou botão: a tela abre na lista. */
  it('abre na lista; "Novo reembolso" abre o formulário', () => {
    responderCarga();
    fixture.detectChanges();
    expect(component.mode()).toBe('list');
    expect(fixture.nativeElement.querySelector('app-form-screen')).toBeNull();

    component.abrirForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-form-screen')).not.toBeNull();
  });

  it('pedido aceito volta para a lista e recarrega os totais', () => {
    responderCarga();
    component.abrirForm();
    preencher('10,00');

    component.enviar();
    http.expectOne(API).flush({});
    responderCarga();

    expect(component.mode()).toBe('list');
  });

  /**
   * Antes a recusa só parava o spinner: a API explicava o motivo e a pessoa
   * via o botão voltar ao normal sem saber de nada.
   */
  it('recusa da API aparece junto do botão, com o motivo dela', () => {
    responderCarga();
    component.abrirForm();
    preencher('10,00');

    component.enviar();
    http.expectOne(API).flush(
      { status: 400, message: 'Valor do reembolso precisa ser maior que zero' },
      { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(component.enviando()).toBeFalse();
    expect(component.mode()).toBe('form');
    const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alerta?.textContent).toContain('Valor do reembolso precisa ser maior que zero');
  });

  it('um novo envio apaga o motivo do anterior', () => {
    responderCarga();
    component.erroEnvio.set('motivo antigo');
    preencher('10,00');

    component.enviar();

    expect(component.erroEnvio()).toBeNull();
    http.expectOne(API).flush({});
    responderCarga();
  });

  // ─── o mês ───────────────────────────────────────────────────────────────

  it('a lista mostra só os gastos do mês escolhido', () => {
    responderCarga([
      pedido({ id: 'set', expenseDate: '2026-09-03', category: 'Hospedagem' }),
      pedido({ id: 'ago', expenseDate: '2026-08-28', category: 'Pedágio' }),
    ]);
    fixture.detectChanges();

    expect(texto()).toContain('Hospedagem');
    expect(texto()).not.toContain('Pedágio');
  });

  it('trocar o mês pede os totais daquele mês', () => {
    responderCarga();
    component.mudarMes('2026-08');
    const req = http.expectOne(r => r.url === `${API}/me/summary`);
    expect(req.request.params.get('month')).toBe('2026-08');
    req.flush({ ...VAZIO, month: '2026-08' });
  });

  // ─── contestação ─────────────────────────────────────────────────────────

  it('recusado dentro do prazo mostra "Contestar" e até quando', () => {
    responderCarga([pedido({
      status: 'REJECTED', reviewNotes: 'Comprovante ilegível', reviewedAt: '2026-09-05T10:00:00',
      contestDeadline: '2026-10-05T10:00:00',
    })]);
    fixture.detectChanges();

    expect(texto()).toContain('Contestar');
    expect(texto()).toContain('até 05/10/2026 · uma vez só');
  });

  /** Sem prazo vindo da API, não há botão — é a API quem decide se ainda dá. */
  it('recusado de novo depois de contestar: sem botão, e diz que é final', () => {
    responderCarga([pedido({
      status: 'REJECTED', reviewNotes: 'Continua sem CNPJ', contestedAt: '2026-09-08T09:00:00',
      contestComment: 'Segue a nota', firstReviewNotes: 'Comprovante ilegível',
      firstReviewedAt: '2026-09-05T10:00:00', originalReceiptFilename: 'foto.jpg', contestDeadline: null,
    })]);
    fixture.detectChanges();

    expect(texto()).not.toContain('uma vez só');
    expect(texto()).toContain('A contestação já foi usada');
    expect(texto()).toContain('Você contestou: “Segue a nota”');
    expect(texto()).toContain('Original');
  });

  it('contestar manda o comentário e o comprovante novo, e recarrega', () => {
    const recusado = pedido({ status: 'REJECTED', reviewNotes: 'ilegível', contestDeadline: '2026-10-05T10:00:00' });
    responderCarga([recusado]);

    component.abrirContestacao(recusado);
    expect(component.podeContestar).toBeFalse();
    component.contestFile = new File(['%PDF'], 'nota-nova.pdf', { type: 'application/pdf' });
    component.contestComment = '  Segue a nota escaneada  ';
    expect(component.podeContestar).toBeTrue();

    component.contestar();
    const req = http.expectOne(`${API}/r1/contest`);
    const body = req.request.body as FormData;
    expect(body.get('comment')).toBe('Segue a nota escaneada');
    expect((body.get('receipt') as File).name).toBe('nota-nova.pdf');
    req.flush(pedido({ status: 'PENDING', contestedAt: '2026-09-28T10:00:00' }));
    responderCarga();

    expect(component.contestTarget()).toBeNull();
  });

  it('contestação recusada pela API mostra o motivo e mantém a janela aberta', () => {
    const recusado = pedido({ status: 'REJECTED', reviewNotes: 'ilegível', contestDeadline: '2026-10-05T10:00:00' });
    responderCarga([recusado]);
    component.abrirContestacao(recusado);
    component.contestFile = new File(['%PDF'], 'n.pdf');
    component.contestComment = 'x';

    component.contestar();
    http.expectOne(`${API}/r1/contest`).flush(
      { message: 'O prazo para contestar terminou em 05/10/2026' }, { status: 409, statusText: 'Conflict' });

    expect(component.erroContestacao()).toBe('O prazo para contestar terminou em 05/10/2026');
    expect(component.contestTarget()).not.toBeNull();
  });
});
