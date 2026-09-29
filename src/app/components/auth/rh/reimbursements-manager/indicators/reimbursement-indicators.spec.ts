import { Reimbursement } from '../../../../../domain/models/hr/reimbursement.model';
import {
  categoryKey, computeKpis, monthlyEvolution, percentChange, periodOf, previousLabel,
  rankBy, shiftPeriod, topWithOthers,
} from './reimbursement-indicators';

function r(partial: Partial<Reimbursement>): Reimbursement {
  return {
    id: crypto.randomUUID(), employeeId: 'e1', expenseDate: '2026-09-10', amount: 100, category: 'Gasolina',
    reason: '', receiptOriginalFilename: 'a.pdf', status: 'PENDING', requestedAt: '2026-09-10T10:00:00',
    reviewedById: null, reviewedAt: null, reviewNotes: null, paymentDate: null, paidAt: null,
    contestedAt: null, contestComment: null, originalReceiptFilename: null,
    firstReviewedById: null, firstReviewedAt: null, firstReviewNotes: null, contestDeadline: null,
    ...partial,
  };
}

/**
 * As contas da aba Indicadores, com datas fixas. O que se protege: o período
 * certo (pela data do GASTO), a comparação sem base não virar 100%, e o
 * recusado não contar como dinheiro.
 */
describe('reimbursement-indicators', () => {

  describe('períodos', () => {
    it('mês, trimestre e ano, com os limites inclusivos', () => {
      expect(periodOf('month', 2026, 2)).toEqual(jasmine.objectContaining({ from: '2026-02-01', to: '2026-02-28', label: 'Fevereiro 2026' }));
      expect(periodOf('quarter', 2026, 8)).toEqual(jasmine.objectContaining({ from: '2026-07-01', to: '2026-09-30', label: '3º tri 2026' }));
      expect(periodOf('year', 2026, 9)).toEqual(jasmine.objectContaining({ from: '2026-01-01', to: '2026-12-31', label: '2026' }));
    });

    /** A virada do ano é onde a conta de mês costuma quebrar. */
    it('o anterior atravessa a virada do ano', () => {
      expect(shiftPeriod(periodOf('month', 2026, 1), -1).label).toBe('Dezembro 2025');
      expect(shiftPeriod(periodOf('quarter', 2026, 2), -1).label).toBe('4º tri 2025');
      expect(previousLabel(periodOf('month', 2026, 9))).toBe('agosto');
      expect(previousLabel(periodOf('year', 2026, 9))).toBe('2025');
    });
  });

  /** Decisão dele: acento, caixa e espaço não separam; palavra diferente separa. */
  it('categoria agrupa sem acento, caixa e espaço', () => {
    expect(categoryKey('Gasolina')).toBe(categoryKey('  gasolina '));
    expect(categoryKey('Alimentação')).toBe(categoryKey('alimentacao'));
    expect(categoryKey('Gasolina')).not.toBe(categoryKey('Combustível'));
  });

  describe('os cartões', () => {
    const setembro = periodOf('month', 2026, 9);

    it('soma por situação, só dentro do período pela data do gasto', () => {
      const list = [
        r({ amount: 100, status: 'PAID' }),
        r({ amount: 50, status: 'APPROVED' }),
        r({ amount: 30, status: 'PENDING' }),
        r({ amount: 20, status: 'REJECTED' }),
        r({ amount: 999, status: 'PAID', expenseDate: '2026-08-31', requestedAt: '2026-09-02T10:00:00' }),
      ];
      const k = computeKpis(list, setembro, '2026-09-29');

      expect(k.requested).toEqual({ amount: 200, count: 4 });
      expect(k.paid.amount).toBe(100);
      expect(k.approved.amount).toBe(50);
      expect(k.pending.amount).toBe(30);
      // 2 aprovados/pagos entre 3 decididos; o pendente não entra na conta.
      expect(k.approvalRate).toBe(67);
      expect(k.averageTicket).toBe(50);
    });

    it('em análise há mais de 7 dias conta pela data do pedido', () => {
      const k = computeKpis([
        r({ requestedAt: '2026-09-20T10:00:00' }),
        r({ requestedAt: '2026-09-21T10:00:00' }),
        r({ requestedAt: '2026-09-22T10:00:00' }),
      ], setembro, '2026-09-29');

      expect(k.pendingOld).toBe(2);
    });

    /** O contestado foi analisado duas vezes; a espera que conta é a do pedido original. */
    it('o tempo até a análise usa a primeira análise', () => {
      const k = computeKpis([
        r({ status: 'APPROVED', requestedAt: '2026-09-01T10:00:00', firstReviewedAt: '2026-09-03T09:00:00', reviewedAt: '2026-09-20T09:00:00' }),
        r({ status: 'REJECTED', requestedAt: '2026-09-01T10:00:00', reviewedAt: '2026-09-02T09:00:00' }),
      ], setembro, '2026-09-29');

      expect(k.daysToReview).toBe(1.5);
    });

    it('o tempo até o pagamento vai da aprovação à data do pagamento', () => {
      const k = computeKpis([
        r({ status: 'PAID', reviewedAt: '2026-09-10T10:00:00', paymentDate: '2026-09-14' }),
        r({ status: 'PAID', reviewedAt: '2026-09-10T10:00:00', paymentDate: '2026-09-16' }),
      ], setembro, '2026-09-29');

      expect(k.daysToPay).toBe(5);
    });

    it('sem pedido no período, taxa, ticket e prazos são nulos — e não zero', () => {
      const k = computeKpis([], setembro, '2026-09-29');
      expect(k.approvalRate).toBeNull();
      expect(k.averageTicket).toBeNull();
      expect(k.daysToReview).toBeNull();
    });
  });

  /** "De zero para R$ 500" não tem porcentagem; mostrar 100% ou ∞ mentiria. */
  it('variação sem base é nula', () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  it('a evolução são os 12 meses que terminam no fim do período, sem os recusados', () => {
    const pontos = monthlyEvolution([
      r({ status: 'PAID', amount: 10, expenseDate: '2026-09-05' }),
      r({ status: 'REJECTED', amount: 99, expenseDate: '2026-09-05' }),
      r({ status: 'APPROVED', amount: 7, expenseDate: '2025-10-01' }),
      r({ status: 'PAID', amount: 5, expenseDate: '2025-09-30' }),
    ], periodOf('quarter', 2026, 8));

    expect(pontos.length).toBe(12);
    expect(pontos[0]).toEqual(jasmine.objectContaining({ label: 'out', year: 2025, approved: 7 }));
    expect(pontos[11]).toEqual(jasmine.objectContaining({ label: 'set', year: 2026, paid: 10, pending: 0 }));
  });

  describe('rankings', () => {
    /** O ranking responde "para onde vai o dinheiro": recusado não custou nada. */
    it('agrupa sem os recusados, do maior para o menor, com a grafia mais usada', () => {
      const rows = rankBy([
        r({ category: 'gasolina ', amount: 10 }),
        r({ category: 'Gasolina', amount: 20 }),
        r({ category: 'Gasolina', amount: 5 }),
        r({ category: 'Hotel', amount: 50 }),
        r({ category: 'Hotel', amount: 500, status: 'REJECTED' }),
      ], x => categoryKey(x.category), x => x.category.trim());

      expect(rows.map(row => [row.label, row.amount, row.count])).toEqual([['Hotel', 50, 1], ['Gasolina', 35, 3]]);
    });

    it('o donut fica com os primeiros e o resto em "Outros"', () => {
      const rows = [1, 2, 3, 4, 5, 6, 7].map(n => ({ key: `k${n}`, label: `C${n}`, amount: 100 - n, count: 1 }));
      const top = topWithOthers(rows, 5);

      expect(top.length).toBe(6);
      expect(top[5]).toEqual(jasmine.objectContaining({ label: 'Outros', amount: 187, count: 2 }));
      expect(topWithOthers(rows.slice(0, 6), 5).length).withContext('uma fatia sobrando não vira "Outros"').toBe(6);
    });
  });
});
