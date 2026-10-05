import { CareerHistoryResponse } from '../../../../domain/models/hr/career.model';
import { EmployeeDocument } from '../../../../domain/models/hr/employee-document.model';
import { absenceTimeline, careerNewestFirst, documentsByAttention, initials } from './employee-profile.logic';

function carreira(id: string, effectiveDate: string): CareerHistoryResponse {
  return { id, employeeId: 'e', positionId: 'p', positionLevelId: 'l', salary: 1, contractType: 'CLT' as never,
           reason: 'PROMOTION', effectiveDate };
}

function documento(title: string, status: EmployeeDocument['status']): EmployeeDocument {
  return { id: title, employeeId: 'e', employeeName: 'E', typeId: null, typeName: null, title, originalFilename: 'x.pdf',
           contentType: null, sizeBytes: null, dueDate: null, status, daysUntilDue: null, replacedById: null,
           uploadedAt: '2026-01-01T00:00:00', uploadedBy: null };
}

describe('Ficha do funcionário — a regra de leitura', () => {
  it('a carreira vem do mais recente; no mesmo dia, o lançado depois primeiro', () => {
    const lista = careerNewestFirst([carreira('a', '2022-03-14'), carreira('b', '2025-03-01'), carreira('c', '2025-03-01')]);
    expect(lista.map(c => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('documentos na ordem da atenção, e o substituído fica de fora', () => {
    const lista = documentsByAttention([
      documento('Contrato', 'NO_DUE_DATE'), documento('ASO', 'EXPIRING'), documento('CNH', 'EXPIRED'),
      documento('ASO antigo', 'REPLACED'), documento('NR-35', 'VALID'),
    ]);
    expect(lista.map(d => d.title)).toEqual(['CNH', 'ASO', 'NR-35', 'Contrato']);
  });

  it('férias e atestados numa linha do tempo, o mais recente primeiro, com a situação em palavras', () => {
    const lista = absenceTimeline(
      [{ id: 'v', employeeId: 'e', startDate: '2026-01-02', endDate: '2026-01-16', daysRequested: 15, replacementEmployeeId: null,
         status: 'APPROVED', requestedAt: '', reviewedById: null, reviewedAt: null, reviewNotes: null }],
      [{ id: 'm', employeeId: 'e', employeeName: 'E', startDate: '2026-09-29', endDate: '2026-09-30', daysCount: 2,
         submissionType: 'FILE', confirmedLegible: null, originalFilename: 'a.pdf', submittedAt: '', status: 'PENDING',
         reviewedByName: null, reviewedAt: null, reviewNotes: null, resubmittedAt: null, resubmitComment: null,
         resubmitDeadline: null, previousAttempts: [] }],
    );
    expect(lista.map(a => [a.kind, a.status])).toEqual([['CERTIFICATE', 'Em conferência'], ['VACATION', 'Aprovadas']]);
  });

  it('iniciais: primeira e última', () => {
    expect(initials('Ana Maria Souza')).toBe('AS');
    expect(initials('Rita')).toBe('R');
    expect(initials('  ')).toBe('?');
  });
});
