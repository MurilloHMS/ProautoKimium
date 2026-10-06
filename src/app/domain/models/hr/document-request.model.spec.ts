import {
  Recipient,
  RequestField,
  answerText,
  answersSheet,
  canAnswer,
  formProblems,
  newField,
  tallyChoices,
} from './document-request.model';

function campo(over: Partial<RequestField>): RequestField {
  return { key: 'k', label: 'Campo', help: null, type: 'SHORT_TEXT', required: true, options: [], documentTypeId: null, ...over };
}

function resposta(over: Partial<Recipient>): Recipient {
  return {
    id: 'r', requestId: 'q', requestTitle: 'Uniforme', requestInstructions: null, requestDueDate: null,
    requestStatus: 'OPEN', form: [], requestTemplateFilename: null, employeeId: 'e', employeeName: 'Ana',
    status: 'PENDING', answers: {}, addedAt: '2026-10-01T09:00:00', submittedAt: null, reviewedBy: null,
    reviewedAt: null, returnReason: null, files: [], ...over,
  };
}

describe('document-request.model', () => {
  it('campo novo ganha chave que não colide com as que já existem', () => {
    const existentes = [campo({ key: 'fabc123' }), campo({ key: 'fdef456' })];
    for (let i = 0; i < 50; i++) {
      const novo = newField('FILE', existentes);
      expect(existentes.map(f => f.key)).not.toContain(novo.key);
      expect(novo.type).toBe('FILE');
      expect(novo.required).toBeTrue();
    }
  });

  it('o que impede o envio: título, nenhum campo, campo sem nome, escolha sem opção', () => {
    expect(formProblems('', [campo({})])).toContain('Dê um título para a solicitação.');
    expect(formProblems('RG', [])).toContain('Adicione pelo menos um campo.');
    expect(formProblems('RG', [campo({ label: ' ' })])).toContain('O campo 1 está sem nome.');
    expect(formProblems('Uniforme', [campo({ label: 'Camisa', type: 'CHOICE' })]))
      .toContain('"Camisa" precisa de pelo menos uma opção.');
    expect(formProblems('Uniforme', [campo({ label: 'Camisa', type: 'CHOICE', options: ['P'] })])).toEqual([]);
  });

  it('a resposta mostrada: Sim/Não por extenso, data do Brasil, vazio vira travessão', () => {
    expect(answerText(campo({ type: 'YES_NO' }), true)).toBe('Sim');
    expect(answerText(campo({ type: 'YES_NO' }), false)).toBe('Não');
    expect(answerText(campo({ type: 'DATE' }), '2026-10-20')).toBe('20/10/2026');
    expect(answerText(campo({}), '')).toBe('—');
    expect(answerText(campo({}), null)).toBe('—');
    expect(answerText(campo({ type: 'NUMBER' }), 42)).toBe('42');
  });

  it('os Totais contam só enviadas e aprovadas, na ordem das opções do RH', () => {
    const camisa = campo({ key: 'camisa', label: 'Camisa', type: 'CHOICE', options: ['P', 'M', 'G'] });
    const lista = [
      resposta({ status: 'APPROVED', answers: { camisa: 'M' } }),
      resposta({ status: 'SUBMITTED', answers: { camisa: 'M' } }),
      resposta({ status: 'SUBMITTED', answers: { camisa: 'G' } }),
      // devolvida vai mudar, pendente não respondeu: fora da conta
      resposta({ status: 'RETURNED', answers: { camisa: 'P' } }),
      resposta({ status: 'PENDING', answers: { camisa: 'P' } }),
    ];

    const [total] = tallyChoices([camisa, campo({ key: 'obs' })], lista);

    expect(total.field.key).toBe('camisa');
    expect(total.counts).toEqual([{ option: 'P', n: 0 }, { option: 'M', n: 2 }, { option: 'G', n: 1 }]);
    expect(total.answered).toBe(3);
  });

  it('a planilha: uma linha por pessoa, uma coluna por campo, arquivo pelo nome', () => {
    const rg = campo({ key: 'rg', label: 'RG', type: 'FILE' });
    const camisa = campo({ key: 'camisa', label: 'Camisa', type: 'CHOICE', options: ['M'] });
    const [linha] = answersSheet([rg, camisa], [resposta({
      status: 'APPROVED', answers: { camisa: 'M' },
      files: [{ id: 'f', fieldKey: 'rg', originalFilename: 'rg-ana.pdf', uploadedAt: '' }],
    })]);

    expect(linha).toEqual({ Funcionário: 'Ana', Situação: 'Aprovada', RG: 'rg-ana.pdf', Camisa: 'M' });
  });

  it('responder: só aberta, e só pendente ou devolvida', () => {
    expect(canAnswer(resposta({ status: 'PENDING' }))).toBeTrue();
    expect(canAnswer(resposta({ status: 'RETURNED' }))).toBeTrue();
    expect(canAnswer(resposta({ status: 'SUBMITTED' }))).toBeFalse();
    expect(canAnswer(resposta({ status: 'APPROVED' }))).toBeFalse();
    expect(canAnswer(resposta({ status: 'PENDING', requestStatus: 'CLOSED' }))).toBeFalse();
  });
});
