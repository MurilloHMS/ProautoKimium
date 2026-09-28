import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReimbursementTotalsComponent } from './reimbursement-totals.component';
import { ReimbursementSummary } from '../../../../domain/models/hr/reimbursement.model';
import { providersDeTeste } from '../../../../../testing/test-setup';

const TOTAIS: ReimbursementSummary = {
  month: '2026-09',
  sent: { amount: 1694.9, count: 7 },
  pending: { amount: 416.5, count: 2 },
  approved: { amount: 92, count: 1 },
  paid: { amount: 180, count: 1 },
  contestedPending: 1,
};

describe('ReimbursementTotalsComponent', () => {
  let fixture: ComponentFixture<ReimbursementTotalsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReimbursementTotalsComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(ReimbursementTotalsComponent);
    fixture.componentRef.setInput('summary', TOTAIS);
    fixture.detectChanges();
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  it('mostra R$ e quantidade nos quatro cartões, com o contestado à parte', () => {
    const t = texto().replace(/ /g, ' ');
    expect(t).toContain('Enviado');
    expect(t).toContain('R$ 1.694,90');
    expect(t).toContain('7 pedidos');
    expect(t).toContain('2 pedidos · 1 contestado');
    expect(t).toContain('Aprovado, a pagar');
    expect(t).toContain('1 pedido');
  });

  it('só é clicável quando pedido, e o clique entrega o status do cartão', () => {
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);

    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();
    const escolhidos: unknown[] = [];
    fixture.componentInstance.select.subscribe(s => escolhidos.push(s));
    const botoes = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    botoes[0].click();
    botoes[1].click();

    expect(escolhidos).toEqual([null, 'PENDING']);
  });
});
