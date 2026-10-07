import {
  EmailRow,
  EmailSummary,
  Sender,
  SenderRoute,
  activityText,
  attemptDots,
  buildChart,
  deactivateBlock,
  filterByFailure,
  isAddressFailure,
  lastEventText,
  minutesWaiting,
  onlyFailedSelection,
  originLabel,
  selectableIds,
  senderChoices,
  statusChips,
  statusInfo,
  usedByText,
  validateNewSender,
} from './email-queue.model';

function row(over: Partial<EmailRow> = {}): EmailRow {
  return {
    id: 'e1', to: 'ana@x.com', subject: 'Assunto', origin: 'NEWSLETTER', originLabel: 'Newsletter',
    status: 'SENT', attempts: 1, createdAt: '2026-10-07T10:00:00', sentAt: '2026-10-07T10:00:20',
    lastAttemptAt: '2026-10-07T10:00:20', lastError: null, failureKind: null, failureLabel: null, hasAttachments: false,
    resendable: (over.status ?? 'SENT') === 'FAILED',
    ...over,
  };
}

function sender(over: Partial<Sender> = {}): Sender {
  return {
    id: 's1', name: 'rh', address: 'rh@envios.proautokimium.com.br', displayName: 'RH',
    active: true, isDefault: false, usedBy: [], ...over,
  };
}

describe('email-queue.model', () => {
  describe('statusInfo', () => {
    it('status conhecido vira rótulo e cor', () => {
      expect(statusInfo('FAILED')).toEqual(jasmine.objectContaining({ label: 'Falhou', chip: 'danger' }));
      expect(statusInfo('PENDING').label).toBe('Na fila');
    });

    it('status antigo aparece cru, em cor neutra', () => {
      expect(statusInfo('RETRYING')).toEqual(jasmine.objectContaining({ label: 'RETRYING', chip: 'neutral' }));
    });
  });

  it('e-mail sem origem mostra "Sem origem"', () => {
    expect(originLabel(null)).toBe('Sem origem');
    expect(originLabel('NEWSLETTER', null)).toBe('Newsletter');
    expect(originLabel('NEWSLETTER', 'Da API')).toBe('Da API');
  });

  it('as bolinhas acendem até as tentativas e param em cinco', () => {
    expect(attemptDots(2).map(d => d.on)).toEqual([true, true, false, false, false]);
    expect(attemptDots(9).filter(d => d.on).length).toBe(5);
    expect(attemptDots(0).filter(d => d.on).length).toBe(0);
  });

  it('erro de endereço é só caixa inexistente ou endereço inválido', () => {
    expect(isAddressFailure('MAILBOX_NOT_FOUND')).toBeTrue();
    expect(isAddressFailure('INVALID_ADDRESS')).toBeTrue();
    expect(isAddressFailure('TIMEOUT')).toBeFalse();
    expect(isAddressFailure(null)).toBeFalse();
  });

  it('a espera da fila é contada em minutos, pela hora local', () => {
    const agora = new Date(2026, 9, 7, 14, 30);
    expect(minutesWaiting('2026-10-07T14:18:00', agora)).toBe(12);
    expect(minutesWaiting(null, agora)).toBeNull();
  });

  it('a faixa do agendador usa a última atividade', () => {
    expect(activityText('2026-10-07T17:42:05')).toBe('última atividade às 17:42');
    expect(activityText(null)).toBe('nenhuma atividade no período');
  });

  describe('buildChart', () => {
    const perDay = [
      { date: '2026-10-01', sent: 10, failed: 2, retried: 3 },
      { date: '2026-10-02', sent: 0, failed: 0, retried: 0 },
    ];

    it('uma barra por dia, com a escala arredondada para a dezena de cima', () => {
      const c = buildChart(perDay);
      expect(c.bars.length).toBe(2);
      expect(c.ticks.map(t => t.value)).toEqual([0, 10, 20]);
      expect(c.bars[0].label).toBe('01/10');
    });

    it('falhas empilham sobre os enviados e o dia zerado não tem altura', () => {
      const [cheio, zerado] = buildChart(perDay).bars;
      expect(cheio.failedY + cheio.failedH).toBeCloseTo(cheio.sentY);
      expect(cheio.retriedH).toBeLessThan(cheio.sentH);
      expect(zerado.sentH).toBe(0);
      expect(zerado.failedH).toBe(0);
    });

    it('os que insistiram nunca passam dos enviados', () => {
      const [b] = buildChart([{ date: '2026-10-01', sent: 2, failed: 0, retried: 5 }]).bars;
      expect(b.retriedH).toBeCloseTo(b.sentH);
    });
  });

  it('os chips contam pelo resumo; sem resumo, sem número', () => {
    const s = { failed: 3, queued: 2, sent: 10 } as EmailSummary;
    const chips = statusChips(s);
    expect(chips.find(c => c.key === null)?.count).toBe(15);
    expect(chips.find(c => c.key === 'FAILED')?.count).toBe(3);
    expect(statusChips(null).every(c => c.count === null)).toBeTrue();
  });

  it('o filtro por motivo roda sobre as linhas carregadas', () => {
    const rows = [row({ id: 'a', failureKind: 'TIMEOUT' }), row({ id: 'b', failureKind: 'AUTH' })];
    expect(filterByFailure(rows, 'AUTH').map(r => r.id)).toEqual(['b']);
    expect(filterByFailure(rows, null).length).toBe(2);
  });

  it('e-mail com código de acesso que falhou não é selecionável: a API diz que não se reenvia', () => {
    const rows = [row({ id: 'a', status: 'FAILED' }), row({ id: 'r', status: 'FAILED', origin: 'PASSWORD_RESET', resendable: false })];
    expect(selectableIds(rows)).toEqual(['a']);
  });

  it('só os FAILED são selecionáveis, e a seleção esquece quem deixou de ser', () => {
    const rows = [row({ id: 'a', status: 'FAILED' }), row({ id: 'b', status: 'SENT' }), row({ id: 'c', status: 'PENDING' })];
    expect(selectableIds(rows)).toEqual(['a']);
    expect(onlyFailedSelection(['a', 'b', 'x'], rows)).toEqual(['a']);
  });

  describe('lastEventText', () => {
    it('enviado mostra a hora do envio', () => {
      expect(lastEventText(row())).toBe('enviado 07/10 10:00');
    });
    it('com erro mostra o motivo legível', () => {
      expect(lastEventText(row({ status: 'FAILED', failureLabel: 'Caixa postal não existe', lastError: '550' }))).toBe('Caixa postal não existe');
    });
    it('na fila e agendado dizem o que esperam', () => {
      expect(lastEventText(row({ status: 'PENDING', sentAt: null }))).toBe('aguardando a próxima passada');
      expect(lastEventText(row({ status: 'SCHEDULED', sentAt: null }))).toBe('aguardando o horário');
    });
  });

  describe('remetentes', () => {
    it('valida como a API: nome de exibição, caracteres e repetido', () => {
      const existentes = [sender({ name: 'rh' })];
      expect(validateNewSender('financeiro', '', existentes)).toContain('nome que aparece');
      expect(validateNewSender('fin anceiro', 'Fin', existentes)).toContain('letras');
      expect(validateNewSender('Fin@x', 'Fin', existentes)).toContain('letras');
      expect(validateNewSender('RH', 'RH 2', existentes)).toContain('já está cadastrado');
      expect(validateNewSender('financeiro.2_a-b', 'Financeiro', existentes)).toBeNull();
    });

    it('Desativar trava no padrão e no usado', () => {
      expect(deactivateBlock(sender({ isDefault: true }))).toContain('padrão');
      expect(deactivateBlock(sender({ usedBy: ['NEWSLETTER'] }))).toContain('Troque');
      expect(deactivateBlock(sender())).toBeNull();
    });

    it('"usado por" usa o rótulo das rotas', () => {
      const routes = [{ origin: 'NEWSLETTER', label: 'Newsletter da casa' } as SenderRoute];
      expect(usedByText(sender({ usedBy: ['NEWSLETTER', 'MANUAL'] }), routes))
        .toBe('Usado por 2 serviço(s): Newsletter da casa, Envio manual');
      expect(usedByText(sender(), routes)).toBe('Nenhum serviço usa este endereço.');
    });

    it('o select de rota mostra os ativos e o inativo que está escolhido hoje', () => {
      const lista = [sender({ id: 'a' }), sender({ id: 'b', active: false }), sender({ id: 'c', active: false })];
      expect(senderChoices(lista, 'b').map(s => s.id)).toEqual(['a', 'b']);
      expect(senderChoices(lista, null).map(s => s.id)).toEqual(['a']);
    });
  });
});
