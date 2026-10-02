import { Reimbursement } from '../../../../domain/models/hr/reimbursement.model';
import { alertsFor, groupByEmployee, isPdfReceipt, median, usualByCategory, waitingFor } from './pending-queue.logic';

function pedido(extra: Partial<Reimbursement>): Reimbursement {
  return {
    id: 'r', employeeId: 'e1', expenseDate: '2026-09-30', amount: 50, category: 'Alimentação', reason: 'Almoço',
    receiptOriginalFilename: 'nota.jpg', status: 'PENDING', requestedAt: '2026-10-01T09:00:00',
    reviewedById: null, reviewedAt: null, reviewNotes: null, paymentDate: null, paidAt: null,
    contestedAt: null, contestComment: null, originalReceiptFilename: null, firstReviewedById: null,
    firstReviewedAt: null, firstReviewNotes: null, contestDeadline: null,
    ...extra,
  };
}

describe('Pendências — a regra da fila de reembolsos', () => {

  describe('repetido', () => {
    it('mesma pessoa, mesmo valor e mesmo dia: os dois pedidos ganham alerta', () => {
      const a = pedido({ id: 'a', amount: 42.5 });
      const b = pedido({ id: 'b', amount: 42.5 });
      const alerts = alertsFor([a, b], new Map());
      expect(alerts.get('a')?.[0].label).toBe('Mesmo valor e dia, 2×');
      expect(alerts.get('b')?.[0].kind).toBe('DUPLICATE');
    });

    it('outra pessoa, outro dia ou outro valor não é repetido', () => {
      const base = pedido({ id: 'a', amount: 42.5 });
      const alerts = alertsFor([
        base,
        pedido({ id: 'b', amount: 42.5, employeeId: 'e2' }),
        pedido({ id: 'c', amount: 42.5, expenseDate: '2026-09-29' }),
        pedido({ id: 'd', amount: 42.49 }),
      ], new Map());
      expect(alerts.size).toBe(0);
    });
  });

  describe('acima do comum', () => {
    const base = [10, 20, 30, 40, 50].map((v, i) => pedido({ id: `h${i}`, category: 'Hospedagem', amount: v * 10, status: 'PAID' }));

    it('mais que o dobro da mediana da categoria ganha alerta; até o dobro, não', () => {
      const usual = usualByCategory(base); // mediana 300
      const alerts = alertsFor([
        pedido({ id: 'alto', category: 'hospedagem ', amount: 601 }),
        pedido({ id: 'limite', category: 'Hospedagem', amount: 600 }),
      ], usual);
      expect(alerts.get('alto')?.[0].kind).toBe('ABOVE_USUAL');
      expect(alerts.has('limite')).toBeFalse();
    });

    it('com menos de 5 pedidos na categoria não há mediana, e nada é marcado', () => {
      const usual = usualByCategory(base.slice(0, 4));
      expect(usual.size).toBe(0);
      expect(alertsFor([pedido({ id: 'x', category: 'Hospedagem', amount: 5000 })], usual).size).toBe(0);
    });

    it('mediana de lista par é a média dos dois do meio', () => {
      expect(median([4, 1, 3, 2])).toBe(2.5);
      expect(median([])).toBeNull();
    });
  });

  describe('agrupado por pessoa', () => {
    it('soma, conta as categorias e põe primeiro quem espera há mais tempo', () => {
      const groups = groupByEmployee([
        pedido({ id: '1', employeeId: 'joao', amount: 100, category: 'Combustível', requestedAt: '2026-10-02T08:00:00' }),
        pedido({ id: '2', employeeId: 'joao', amount: 50.3, category: 'Alimentação', requestedAt: '2026-10-02T09:00:00' }),
        pedido({ id: '3', employeeId: 'joao', amount: 80, category: 'Combustível', requestedAt: '2026-10-02T10:00:00' }),
        pedido({ id: '4', employeeId: 'lia', amount: 20, requestedAt: '2026-09-30T08:00:00' }),
      ], id => id === 'joao' ? 'João Lima' : 'Lia Prado', new Map([['3', [{ kind: 'DUPLICATE', label: 'x' }]]]));

      expect(groups.map(g => g.employeeName)).toEqual(['Lia Prado', 'João Lima']);
      const joao = groups[1];
      expect(joao.total).toBeCloseTo(230.3, 2);
      expect(joao.categories).toBe('Combustível 2, Alimentação 1');
      expect([...joao.alerts.keys()]).toEqual(['3']);
    });
  });

  it('espera em dias de calendário', () => {
    const now = new Date(2026, 9, 2, 8, 0);
    expect(waitingFor('2026-10-02T07:00:00', now)).toBe('hoje');
    expect(waitingFor('2026-10-01T23:00:00', now)).toBe('1 dia');
    expect(waitingFor('2026-09-28T10:00:00', now)).toBe('4 dias');
  });

  it('PDF pelo tipo; sem tipo útil, pela extensão; foto nunca vira PDF', () => {
    expect(isPdfReceipt('application/pdf', 'nota.jpg')).toBeTrue();
    expect(isPdfReceipt('image/jpeg', 'nota.pdf')).toBeFalse();
    expect(isPdfReceipt('application/octet-stream', 'NOTA.PDF')).toBeTrue();
    expect(isPdfReceipt('', 'foto.heic')).toBeFalse();
  });
});
