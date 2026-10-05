import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { PendingQueueComponent } from './pending-queue.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { Reimbursement } from '../../../../domain/models/hr/reimbursement.model';
import { environment } from '../../../../../environments/environment';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

const API = environment.apiUrl;

function pedido(extra: Partial<Reimbursement>): Reimbursement {
  return {
    id: 'r', employeeId: 'joao', expenseDate: '2026-09-30', amount: 50, category: 'Alimentação', reason: 'Almoço',
    receiptOriginalFilename: 'nota.jpg', status: 'PENDING', requestedAt: '2026-10-01T09:00:00',
    reviewedById: null, reviewedAt: null, reviewNotes: null, paymentDate: null, paidAt: null,
    contestedAt: null, contestComment: null, originalReceiptFilename: null, firstReviewedById: null,
    firstReviewedAt: null, firstReviewNotes: null, contestDeadline: null,
    ...extra,
  };
}

/** João: dois pedidos limpos. Pedro: um repetido (dois iguais) e um limpo. */
const PENDENTES = [
  pedido({ id: 'j1', employeeId: 'joao', amount: 60 }), // mediana da categoria é 33: até 66 não alerta
  pedido({ id: 'j2', employeeId: 'joao', amount: 20, expenseDate: '2026-09-29' }),
  pedido({ id: 'p1', employeeId: 'pedro', amount: 33 }),
  pedido({ id: 'p2', employeeId: 'pedro', amount: 33 }),
  pedido({ id: 'p3', employeeId: 'pedro', amount: 12, expenseDate: '2026-09-28' }),
];

describe('PendingQueueComponent', () => {
  let fixture: ComponentFixture<PendingQueueComponent>;
  let component: PendingQueueComponent;
  let http: HttpTestingController;

  async function montar(grade: Record<string, string[]>): Promise<void> {
    larguraDaJanela(NO_COMPUTADOR);
    await TestBed.configureTestingModule({
      imports: [PendingQueueComponent],
      providers: providersDeTeste(),
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    // Quem carrega a grade no app é a guarda da rota; aqui, o teste.
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    fixture = TestBed.createComponent(PendingQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Responde a carga: pendentes, a base do mês, férias, atestados e o cadastro de pessoas. */
  function responder(pendentes: Reimbursement[] = PENDENTES): TestRequest[] {
    const reqs = http.match(() => true);
    for (const r of reqs) {
      const url = r.request.url;
      if (url === `${API}/hr/reimbursements`) {
        r.flush(r.request.params.get('status') === 'PENDING' ? pendentes : []);
      } else if (url.includes('employee') || url.includes('partner')) {
        r.flush([{ id: 'joao', name: 'João Lima', ativo: true }, { id: 'pedro', name: 'Pedro Alves', ativo: true }]);
      } else {
        r.flush([]);
      }
    }
    fixture.detectChanges();
    return reqs;
  }

  afterEach(() => restaurarLargura());

  it('só carrega e mostra as filas das telas que a pessoa tem', async () => {
    await montar({ 'rh/medical-certificates': ['CONSULTAR', 'ALTERAR'] });
    const reqs = responder();

    expect(reqs.some(r => r.request.url.endsWith('/hr/reimbursements'))).toBeFalse();
    expect(reqs.some(r => r.request.url.endsWith('/hr/vacation-requests'))).toBeFalse();
    expect(reqs.some(r => r.request.url.endsWith('/hr/medical-certificates'))).toBeTrue();
    expect(component.kinds()).toEqual(['ATESTADO']);
    expect(component.kind()).toBe('ATESTADO');
  });

  it('agrupa os reembolsos por pessoa e marca o repetido', async () => {
    await montar({ 'rh/reimbursements': ['CONSULTAR', 'ALTERAR'] });
    responder();

    expect(component.groups().length).toBe(2);
    const pedro = component.groups().find(g => g.employeeId === 'pedro')!;
    expect([...pedro.alerts.keys()].sort()).toEqual(['p1', 'p2']);
    expect(component.alertCount()).toBe(2);
  });

  it('o lote aprova só os pedidos sem alerta dos selecionados, um por vez', async () => {
    await montar({ 'rh/reimbursements': ['CONSULTAR', 'ALTERAR'] });
    responder();

    component.toggleAll();
    expect(component.selectedItems().map(r => r.id).sort()).toEqual(['j1', 'j2', 'p3']);

    component.approveSelected();
    // Sequencial: só um pedido de aprovação aberto por vez.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const aberto = http.match(r => r.url.endsWith('/approve'));
      expect(aberto.length).toBe(1);
      ids.push(aberto[0].request.url.split('/').at(-2)!);
      aberto[0].flush({});
    }
    expect(ids.sort()).toEqual(['j1', 'j2', 'p3']);
    responder([]); // a recarga depois do lote
  });

  it('um pedido recusado pela API no lote não para os outros', async () => {
    await montar({ 'rh/reimbursements': ['CONSULTAR', 'ALTERAR'] });
    responder();
    component.toggle(component.groups().find(g => g.employeeId === 'joao')!);

    component.approveSelected();
    http.expectOne(r => r.url.endsWith('/approve'))
      .flush({ message: 'Você não pode revisar o seu próprio pedido.' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(r => r.url.endsWith('/approve')).flush({});
    responder([]);
    expect(component.batchRunning()).toBeFalse();
  });

  it('grupo em que todo pedido tem alerta não entra no lote', async () => {
    await montar({ 'rh/reimbursements': ['CONSULTAR', 'ALTERAR'] });
    responder([pedido({ id: 'a', employeeId: 'pedro', amount: 9 }), pedido({ id: 'b', employeeId: 'pedro', amount: 9 })]);

    const pedro = component.groups()[0];
    expect(component.canSelect(pedro)).toBeFalse();
    component.toggle(pedro);
    expect(component.selected().size).toBe(0);
  });

  describe('conferência em sequência', () => {
    beforeEach(async () => {
      await montar({ 'rh/reimbursements': ['CONSULTAR', 'ALTERAR'] });
      responder();
      component.startSequence(component.groups().find(g => g.employeeId === 'joao'));
      http.expectOne(r => r.url.endsWith('/j1/receipt')).flush(new Blob(['x'], { type: 'image/jpeg' }));
    });

    function tecla(key: string, target: EventTarget = document.body): void {
      const event = new KeyboardEvent('keydown', { key });
      Object.defineProperty(event, 'target', { value: target });
      component.onKey(event);
    }

    it('A aprova e o próximo comprovante abre sozinho', () => {
      tecla('a');
      http.expectOne(`${API}/hr/reimbursements/j1/approve`).flush({});
      expect(component.current()?.id).toBe('j2');
      // Imagem e não PDF: o visualizador de PDF trava o Chrome sem tela, e
      // a suíte inteira desconectava. A escolha PDF × foto é testada na lógica.
      http.expectOne(r => r.url.endsWith('/j2/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
      expect(component.preview()?.isPdf).toBeFalse();
    });

    it('R sem motivo não recusa; com motivo, recusa', () => {
      tecla('r');
      http.expectNone(r => r.url.endsWith('/reject'));

      component.sequenceNotes = 'Nota ilegível';
      tecla('r');
      const req = http.expectOne(`${API}/hr/reimbursements/j1/reject`);
      expect(req.request.body).toEqual({ notes: 'Nota ilegível' });
      req.flush({});
      http.expectOne(r => r.url.endsWith('/j2/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
    });

    it('recusar sem motivo não chega na API, nem pelo botão', () => {
      component.sequenceNotes = '   ';
      component.decide('reject');
      http.expectNone(r => r.url.endsWith('/reject'));
      expect(component.current()?.id).toBe('j1');
    });

    /**
     * Defeito visto no navegador: o diálogo punha o foco no campo de motivo,
     * e o "A" virava texto em vez de aprovar.
     */
    it('ao abrir, o foco fica no comprovante, não no campo de motivo', async () => {
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(document.activeElement?.id).toBe('sequenceReceipt');
    });

    it('← volta ao pedido anterior, e no primeiro não faz nada', () => {
      tecla('ArrowLeft');
      expect(component.current()?.id).toBe('j1');
      http.expectNone(r => r.url.endsWith('/receipt'));

      tecla('ArrowRight');
      http.expectOne(r => r.url.endsWith('/j2/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
      tecla('ArrowLeft');
      expect(component.current()?.id).toBe('j1');
      http.expectOne(r => r.url.endsWith('/j1/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
    });

    it('voltando a um pedido já decidido, mostra a decisão e não decide de novo', () => {
      tecla('a');
      http.expectOne(`${API}/hr/reimbursements/j1/approve`).flush({});
      http.expectOne(r => r.url.endsWith('/j2/receipt')).flush(new Blob(['x'], { type: 'image/png' }));

      component.previous();
      http.expectOne(r => r.url.endsWith('/j1/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
      expect(component.currentDecision()).toBe('approved');

      tecla('a');
      component.sequenceNotes = 'mudei de ideia';
      component.decide('reject');
      http.expectNone(r => r.url.includes('/j1/'));
      expect(component.current()?.id).toBe('j1');
    });

    it('dentro do campo de motivo, A é letra e não atalho', () => {
      tecla('a', document.createElement('textarea'));
      http.expectNone(r => r.url.endsWith('/approve'));
      expect(component.current()?.id).toBe('j1');
    });

    it('no último pedido, decidir fecha a sequência e recarrega a fila', () => {
      tecla('ArrowRight');
      http.expectOne(r => r.url.endsWith('/j2/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
      tecla('a');
      http.expectOne(`${API}/hr/reimbursements/j2/approve`).flush({});
      expect(component.current()).toBeNull();
      expect(http.match(r => r.url === `${API}/hr/reimbursements`).length).toBeGreaterThan(0);
      responder([]);
    });
  });

  // ─── Clicar na linha abre a conferência (2026-10-05) ──────────────────────

  describe('clique na linha', () => {
    const ATESTADO = {
      id: 'm1', employeeId: 'pedro', employeeName: 'Pedro Alves', startDate: '2026-10-01', endDate: '2026-10-01',
      daysCount: 1, submissionType: 'PHOTO', confirmedLegible: true, originalFilename: 'foto.jpg',
      submittedAt: '2026-10-01T08:00:00', status: 'PENDING', reviewedByName: null, reviewedAt: null, reviewNotes: null,
      resubmittedAt: null, resubmitComment: null, resubmitDeadline: null, previousAttempts: [],
    };
    const FERIAS = {
      id: 'v1', employeeId: 'joao', startDate: '2026-11-03', endDate: '2026-11-12', daysRequested: 10,
      replacementEmployeeId: 'pedro', status: 'PENDING', requestedAt: '2026-10-01T10:00:00',
      reviewedById: null, reviewedAt: null, reviewNotes: null,
    };

    async function montarTudo(): Promise<void> {
      await montar({ 'rh/reimbursements': ['ALTERAR'], 'rh/vacation-requests': ['ALTERAR'], 'rh/medical-certificates': ['ALTERAR'] });
      for (const r of http.match(() => true)) {
        const url = r.request.url;
        if (url === `${API}/hr/reimbursements`) r.flush(r.request.params.get('status') === 'PENDING' ? PENDENTES : []);
        else if (url === `${API}/hr/vacation-requests`) r.flush([FERIAS]);
        else if (url === `${API}/hr/medical-certificates`) r.flush([ATESTADO]);
        else if (url.includes('employee') || url.includes('partner')) r.flush([{ id: 'joao', name: 'João Lima', ativo: true }, { id: 'pedro', name: 'Pedro Alves', ativo: true }]);
        else r.flush([]);
      }
      fixture.detectChanges();
    }

    function linhas(): HTMLTableRowElement[] {
      return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLTableRowElement>('tbody tr.pq-clicavel'));
    }

    it('reembolso: a linha abre a conferência em sequência daquela pessoa', async () => {
      await montarTudo();
      linhas()[0].click();
      expect(component.current()).not.toBeNull();
      http.expectOne(r => r.url.endsWith('/receipt')).flush(new Blob(['x'], { type: 'image/png' }));
    });

    it('reembolso: marcar a caixinha não abre a conferência', async () => {
      await montarTudo();
      linhas()[0].querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
      expect(component.current()).toBeNull();
      expect(component.selected().size).toBe(1);
    });

    it('atestado: a linha abre a conferência já com o arquivo na tela', async () => {
      await montarTudo();
      component.kind.set('ATESTADO');
      fixture.detectChanges();
      linhas()[0].click();
      expect(component.single()?.certificate?.id).toBe('m1');
      http.expectOne(`${API}/hr/medical-certificates/m1/file`).flush(new Blob(['x'], { type: 'image/jpeg' }));
      expect(component.singlePreview()?.isPdf).toBeFalse();
    });

    it('férias: a linha abre a conferência com o substituto indicado', async () => {
      await montarTudo();
      component.kind.set('FERIAS');
      fixture.detectChanges();
      linhas()[0].click();
      fixture.detectChanges();
      expect(component.single()?.vacation?.id).toBe('v1');
      expect(document.body.textContent).toContain('Substituto indicado');
    });

    it('o ✗ da linha só abre a conferência: recusar ainda exige o motivo', async () => {
      await montarTudo();
      component.kind.set('FERIAS');
      fixture.detectChanges();
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label^="Recusar as férias"]')!.click();
      expect(component.single()?.vacation?.id).toBe('v1');
      http.expectNone(r => r.url.endsWith('/reject'));

      component.confirmSingle('reject');
      http.expectNone(r => r.url.endsWith('/reject'));

      component.singleNotes = 'Período de fechamento';
      component.confirmSingle('reject');
      expect(http.expectOne(`${API}/hr/vacation-requests/v1/reject`).request.body).toEqual({ notes: 'Período de fechamento' });
    });
  });
});
