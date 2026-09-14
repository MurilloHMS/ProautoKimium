import {
  confirmouExclusao,
  erroDoCurriculo,
  formatarData,
  prazoAoRenovar,
  situacaoDaAutorizacao,
  TAMANHO_MAXIMO_DO_CURRICULO,
} from './talent-bank';

function arquivo(nome: string, tipo: string, bytes = 1024): File {
  // Um File de verdade com o tamanho pedido, sem alocar megabytes à toa.
  const file = new File(['x'], nome, { type: tipo });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('erroDoCurriculo', () => {

  it('aceita PDF', () => {
    expect(erroDoCurriculo(arquivo('cv.pdf', 'application/pdf'))).toBeNull();
  });

  it('aceita PDF que o celular entregou sem tipo', () => {
    // Alguns navegadores Android mandam `type` vazio. Recusar pelo tipo
    // barraria um PDF de verdade, e a API confere os bytes de qualquer jeito.
    expect(erroDoCurriculo(arquivo('CV.PDF', ''))).toBeNull();
  });

  it('recusa o que não é PDF', () => {
    expect(erroDoCurriculo(arquivo('cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')))
      .toBe('Envie o currículo em PDF.');
  });

  it('aceita exatamente 10 MB e recusa um byte a mais', () => {
    // O `>` contra `>=`: a API aceita os 10 MB cravados.
    expect(erroDoCurriculo(arquivo('cv.pdf', 'application/pdf', TAMANHO_MAXIMO_DO_CURRICULO))).toBeNull();
    expect(erroDoCurriculo(arquivo('cv.pdf', 'application/pdf', TAMANHO_MAXIMO_DO_CURRICULO + 1)))
      .toBe('O arquivo passa de 10 MB.');
  });
});

describe('confirmouExclusao', () => {

  it('libera com APAGAR', () => {
    expect(confirmouExclusao('APAGAR')).toBeTrue();
  });

  it('libera com o que o teclado do celular escreve sozinho', () => {
    expect(confirmouExclusao('Apagar ')).toBeTrue();
  });

  it('não libera com qualquer outra coisa', () => {
    expect(confirmouExclusao('')).toBeFalse();
    expect(confirmouExclusao(null)).toBeFalse();
    expect(confirmouExclusao('APAGA')).toBeFalse();
    expect(confirmouExclusao('sim')).toBeFalse();
    expect(confirmouExclusao('APAGAR TUDO')).toBeFalse();
  });
});

describe('situacaoDaAutorizacao', () => {
  const agora = new Date(2026, 8, 14, 10, 0, 0); // 14/09/2026 10:00

  it('sem consentimento é "Sem registro", mesmo com data de expiração', () => {
    // As 21 pessoas de antes de 11/09 não disseram sim nem não. Um vencido
    // as esconderia do RH; um autorizado prometeria um aceite que não houve.
    expect(situacaoDaAutorizacao(null, null, agora).rotulo).toBe('Sem registro');
    expect(situacaoDaAutorizacao(null, '2020-01-01T00:00:00', agora).papel).toBe('neutral');
  });

  it('com prazo longe, mostra até quando', () => {
    const s = situacaoDaAutorizacao('2026-09-11T09:00:00', '2028-09-11T09:00:00', agora);
    expect(s.papel).toBe('success');
    expect(s.rotulo).toBe('Até 11/09/2028');
  });

  it('avisa a partir de 30 dias, e não antes', () => {
    expect(situacaoDaAutorizacao('2024-10-14T10:00:00', '2026-10-14T10:00:00', agora).rotulo)
      .toBe('Vence em 30 dias');
    expect(situacaoDaAutorizacao('2024-10-15T10:00:00', '2026-10-15T10:00:00', agora).papel)
      .toBe('success');
  });

  it('diz "amanhã" no último dia', () => {
    expect(situacaoDaAutorizacao('2024-09-15T09:00:00', '2026-09-15T09:00:00', agora).rotulo)
      .toBe('Vence amanhã');
  });

  it('no instante exato do vencimento, já venceu', () => {
    const s = situacaoDaAutorizacao('2024-09-14T10:00:00', '2026-09-14T10:00:00', agora);
    expect(s.papel).toBe('neutral');
    expect(s.rotulo).toBe('Venceu em 14/09/2026');
  });
});

describe('formatarData', () => {

  it('não volta um dia quando a API manda só a data', () => {
    // "2026-09-14" sozinho é meia-noite UTC: no Brasil viraria 13/09 às 21h.
    expect(formatarData('2026-09-14')).toBe('14/09/2026');
  });

  it('formata data e hora sem fuso', () => {
    expect(formatarData('2026-09-14T23:30:00')).toBe('14/09/2026');
  });

  it('mostra traço quando não há data', () => {
    expect(formatarData(null)).toBe('—');
  });
});

describe('prazoAoRenovar', () => {

  it('soma 24 meses', () => {
    expect(prazoAoRenovar(new Date(2026, 8, 14))).toBe('14/09/2028');
  });

  it('encosta no fim do mês, como o plusMonths da API', () => {
    expect(prazoAoRenovar(new Date(2028, 1, 29), 12)).toBe('28/02/2029');
  });
});
