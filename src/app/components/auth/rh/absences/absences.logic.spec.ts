import { CalendarEvent } from '../../../../domain/models/hr/calendar.model';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';
import { buildRows, fromCalendar, fromCertificates, inWindow, summarize, weekStart, windowDays } from './absences.logic';

function ferias(extra: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'v', eventType: 'VACATION', employeeId: 'bruno', employeeName: 'Bruno', teamId: null, teamName: null,
           startDate: '2026-10-05', endDate: '2026-10-09', status: 'APPROVED', ...extra };
}

function atestado(extra: Partial<MedicalCertificate>): MedicalCertificate {
  return {
    id: 'm', employeeId: 'ana', employeeName: 'Ana', startDate: '2026-10-06', endDate: '2026-10-06', daysCount: 1,
    submissionType: 'FILE', confirmedLegible: null, originalFilename: 'a.pdf', submittedAt: '2026-10-06T08:00:00',
    status: 'RECEIVED', reviewedByName: null, reviewedAt: null, reviewNotes: null, resubmittedAt: null,
    resubmitComment: null, resubmitDeadline: null, previousAttempts: [], ...extra,
  };
}

describe('Ausências — a regra da faixa', () => {
  // Segunda-feira, 05/10/2026.
  const segunda = new Date(2026, 9, 5);
  const dias = windowDays(segunda, 14);

  it('a faixa começa na segunda da semana, qualquer que seja o dia', () => {
    expect(weekStart(new Date(2026, 9, 8)).getDate()).toBe(5);  // quinta
    expect(weekStart(new Date(2026, 9, 11)).getDate()).toBe(5); // domingo
    expect(weekStart(segunda).getDate()).toBe(5);
  });

  it('recusados não são ausência: nem férias nem atestado', () => {
    const lista = [
      ...fromCalendar([ferias({ status: 'REJECTED' })]),
      ...fromCertificates([atestado({ status: 'REJECTED' })]),
    ];
    expect(lista).toEqual([]);
  });

  it('atestado em conferência conta como ausência; férias pedidas ficam marcadas como pedido', () => {
    expect(fromCertificates([atestado({ status: 'PENDING' })])[0].pending).toBeFalse();
    expect(fromCalendar([ferias({ status: 'PENDING' })])[0].pending).toBeTrue();
  });

  it('no mesmo dia, atestado vence férias, e férias aprovadas vencem pedidas', () => {
    const rows = buildRows([
      ...fromCalendar([ferias({ employeeId: 'ana', employeeName: 'Ana', startDate: '2026-10-05', endDate: '2026-10-07' })]),
      ...fromCalendar([ferias({ id: 'p', employeeId: 'ana', employeeName: 'Ana', status: 'PENDING', startDate: '2026-10-07', endDate: '2026-10-08' })]),
      ...fromCertificates([atestado({})]),
    ], dias);
    expect(rows[0].days.slice(0, 5)).toEqual(['VACATION', 'CERTIFICATE', 'VACATION', 'VACATION_PENDING', null]);
  });

  it('só entra na faixa quem tem ausência dentro da janela, em ordem de nome', () => {
    const rows = buildRows([
      ...fromCalendar([ferias({ employeeId: 'z', employeeName: 'Zeca' })]),
      ...fromCalendar([ferias({ employeeId: 'b', employeeName: 'Beatriz' })]),
      ...fromCalendar([ferias({ employeeId: 'f', employeeName: 'Fora', startDate: '2026-11-02', endDate: '2026-11-06' })]),
    ], dias);
    expect(rows.map(r => r.name)).toEqual(['Beatriz', 'Zeca']);
  });

  it('o resumo: fora hoje sem repetir pessoa, saídas da semana e pedidos esperando', () => {
    const hoje = new Date(2026, 9, 6);
    const s = summarize([
      ...fromCalendar([ferias({})]),                                                         // Bruno fora
      ...fromCertificates([atestado({}), atestado({ id: 'm2' })]),                          // Ana, duas vezes
      ...fromCalendar([ferias({ employeeId: 'c', startDate: '2026-10-13', endDate: '2026-10-20' })]), // sai em 7 dias
      ...fromCalendar([ferias({ employeeId: 'd', startDate: '2026-10-14', endDate: '2026-10-20' })]), // sai em 8: fora
      ...fromCalendar([ferias({ employeeId: 'e', status: 'PENDING', startDate: '2026-10-06', endDate: '2026-10-06' })]),
      ...fromCalendar([ferias({ employeeId: 'f', status: 'PENDING', startDate: '2026-10-01', endDate: '2026-10-05' })]), // já passou
    ], hoje);
    expect(s).toEqual({ outToday: 2, leavingSoon: 1, pendingRequests: 1 });
  });

  it('a lista do celular traz o que toca a janela, do que começa antes para o depois', () => {
    const lista = inWindow([
      ...fromCalendar([ferias({ employeeId: 'b', employeeName: 'B', startDate: '2026-10-10', endDate: '2026-10-12' })]),
      ...fromCalendar([ferias({ employeeId: 'a', employeeName: 'A', startDate: '2026-09-28', endDate: '2026-10-05' })]),
      ...fromCalendar([ferias({ employeeId: 'x', employeeName: 'X', startDate: '2026-09-20', endDate: '2026-10-04' })]),
    ], dias);
    expect(lista.map(a => a.name)).toEqual(['A', 'B']);
  });
});
