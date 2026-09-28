import { currentMonth, shiftMonth } from './month-switcher.component';

describe('month-switcher', () => {
  it('anda um mês, virando o ano nas duas pontas', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });

  /** `toISOString` viraria o mês às 21h do último dia (UTC-3); pelas partes locais, não. */
  it('o mês de hoje sai pelas partes locais', () => {
    expect(currentMonth(new Date(2026, 8, 30, 22, 30))).toBe('2026-09');
  });
});
