import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ReimbursementIndicatorsComponent, IndicatorDrill } from './reimbursement-indicators.component';
import { periodOf } from './reimbursement-indicators';
import { environment } from '../../../../../../environments/environment';
import { Reimbursement } from '../../../../../domain/models/hr/reimbursement.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/reimbursements`;

/** Datas relativas a hoje: a aba abre no mês corrente. */
const now = new Date();
const pad = (n: number) => `${n}`.padStart(2, '0');
const thisMonth = (day: number) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(day)}`;
const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 5);
const lastMonth = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}-05`;

function r(partial: Partial<Reimbursement>): Reimbursement {
  return {
    id: crypto.randomUUID(), employeeId: 'e1', expenseDate: thisMonth(2), amount: 100, category: 'Gasolina',
    reason: '', receiptOriginalFilename: 'a.pdf', status: 'PAID', requestedAt: `${thisMonth(2)}T10:00:00`,
    reviewedById: null, reviewedAt: null, reviewNotes: null, paymentDate: null, paidAt: null,
    contestedAt: null, contestComment: null, originalReceiptFilename: null,
    firstReviewedById: null, firstReviewedAt: null, firstReviewNotes: null, contestDeadline: null,
    ...partial,
  };
}

describe('ReimbursementIndicatorsComponent', () => {
  let fixture: ComponentFixture<ReimbursementIndicatorsComponent>;
  let component: ReimbursementIndicatorsComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    TestBed.configureTestingModule({ imports: [ReimbursementIndicatorsComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(ReimbursementIndicatorsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // O período é da tela (o seletor mora nela); aqui ele entra pronto.
    fixture.componentRef.setInput('period', periodOf('month', now.getFullYear(), now.getMonth() + 1));
    fixture.detectChanges(false);

    for (const req of http.match(() => true)) {
      if (req.request.url === API) {
        req.flush([
          r({ amount: 120, category: 'Gasolina', employeeId: 'e1' }),
          r({ amount: 80, category: ' gasolina', employeeId: 'e2' }),
          r({ amount: 50, category: 'Hotel', employeeId: 'e2', status: 'PENDING' }),
          r({ amount: 100, expenseDate: lastMonth }),
        ]);
      } else {
        req.flush([]);
      }
    }
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);
  });

  afterEach(() => restaurarLargura());

  /** A lista inteira, uma vez: trocar de período não vai à API. */
  it('pede a lista inteira, sem mês', () => {
    fixture.componentRef.setInput('period', periodOf('year', now.getFullYear() - 1, 1));
    fixture.detectChanges(false);
    http.expectNone(() => true);
    expect(component.all().length).toBe(4);
  });

  it('o mês corrente soma o que é dele e compara com o anterior', () => {
    expect(component.kpis().requested).toEqual({ amount: 250, count: 3 });
    expect(component.kpis().paid.amount).toBe(200);
    // Pago: 200 agora contra 100 no mês passado.
    expect(component.change('paid')).toBe(100);
  });

  it('o ano junta os dois meses', () => {
    fixture.componentRef.setInput('period', periodOf('year', now.getFullYear(), now.getMonth() + 1));
    const esperado = lastMonthDate.getFullYear() === now.getFullYear() ? 350 : 250;
    expect(component.kpis().requested.amount).toBe(esperado);
  });

  /** "Gasolina" e " gasolina" são uma fatia só no donut. */
  it('as categorias grafadas diferente viram uma só', () => {
    expect(component.categories().map(c => [c.label, c.amount])).toEqual([['Gasolina', 200], ['Hotel', 50]]);
  });

  /** O clique leva o recorte do PERÍODO escolhido, não só do mês. */
  it('clicar numa categoria manda o recorte do período para a aba Pedidos', () => {
    let recebido: IndicatorDrill | undefined;
    component.drill.subscribe(d => (recebido = d));
    fixture.componentRef.setInput('period', periodOf('year', now.getFullYear(), now.getMonth() + 1));

    component.openCategory(component.categories()[0]);

    expect(recebido?.categoryKey).toBe('gasolina');
    expect(recebido?.from).toBe(`${now.getFullYear()}-01-01`);
    expect(recebido?.to).toBe(`${now.getFullYear()}-12-31`);
    expect(recebido?.label).toContain('Gasolina');
  });

  it('a comparação aparece nos cartões', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('▲ 100%');
    expect(texto).toContain('comparando com');
  });
});
