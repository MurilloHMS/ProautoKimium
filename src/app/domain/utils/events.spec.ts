import {
  coverDateBox, eventDays, eventPhase, formatPeriod, googleCalendarLink, icsEscape, icsFold, icsForEvent,
  icsForTalk, initialDay, nowInSaoPaulo, phaseLabel, talkStatuses, websiteUrl,
} from './events';
import { EventDetail, EventTalk } from '../models/events.model';

/** Poseidon Week, 22 a 25/09/2026 — o exemplo dele. */
const DIAS = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];

function talk(id: string, date: string, ini: string, fim: string, extra: Partial<EventTalk> = {}): EventTalk {
  return {
    id, title: `Palestra ${id}`, description: null, date, startTime: `${ini}:00`, endTime: `${fim}:00`,
    room: null, locationType: 'EVENT', location: null, speakers: [], ...extra,
  };
}

const poseidon: EventDetail = {
  id: 'ev-1', name: 'Poseidon Week', description: null, startDate: '2026-09-22', endDate: '2026-09-25',
  coverUrl: null, locationType: 'ADDRESS',
  location: {
    source: 'ADDRESS', companyId: null, name: 'Proauto Kimium',
    address: { zipCode: null, street: 'Av. Colombo', number: '5790', complement: null, district: 'Zona 7', city: 'Maringá', state: 'PR', formatted: 'Av. Colombo, 5790 - Zona 7, Maringá - PR' },
  },
  publishedAt: '2026-09-14T10:00:00', updatedAt: null, updatedBy: null, talks: [],
};

describe('nowInSaoPaulo', () => {

  it('usa o relógio de São Paulo, e não o do computador', () => {
    // 01:30 UTC de 23/09 ainda é 22/09 às 22:30 em São Paulo. Com a hora local
    // de uma máquina em UTC, a aba "hoje" abriria no dia errado.
    expect(nowInSaoPaulo(new Date('2026-09-23T01:30:00Z'))).toEqual({ date: '2026-09-22', time: '22:30' });
  });
});

describe('eventDays', () => {

  it('de 22 a 25 são quatro dias', () => {
    expect(eventDays('2026-09-22', '2026-09-25')).toEqual(DIAS);
  });

  it('atravessa a virada de mês', () => {
    expect(eventDays('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('evento de um dia tem uma aba', () => {
    expect(eventDays('2026-11-10', '2026-11-10')).toEqual(['2026-11-10']);
  });
});

describe('initialDay — "priorizar sempre o dia atual"', () => {

  it('hoje dentro do evento abre em hoje', () => {
    expect(initialDay(DIAS, '2026-09-24')).toBe('2026-09-24');
    expect(initialDay(DIAS, '2026-09-22')).toBe('2026-09-22');
  });

  it('antes do evento abre no primeiro dia', () => {
    expect(initialDay(DIAS, '2026-09-14')).toBe('2026-09-22');
  });

  it('depois do evento abre no último dia', () => {
    expect(initialDay(DIAS, '2026-09-26')).toBe('2026-09-25');
  });
});

describe('talkStatuses', () => {
  const talks = [
    talk('a', '2026-09-23', '09:00', '10:30'),
    talk('b', '2026-09-23', '14:00', '15:30'),
    talk('c', '2026-09-23', '16:00', '17:00'),
    talk('d', '2026-09-23', '17:30', '18:30'),
    talk('e', '2026-09-24', '09:00', '11:00'),
    talk('f', '2026-09-22', '09:00', '10:00'),
  ];

  it('às 13:59 a das 14:00 é a seguinte, e só ela', () => {
    const s = talkStatuses(talks, { date: '2026-09-23', time: '13:59' });
    expect(s.get('a')).toBe('passou');
    expect(s.get('b')).toBe('a-seguir');
    expect(s.get('c')).toBe('depois');
  });

  it('às 14:00 ela está no ar, e a das 16:00 vira a seguinte', () => {
    const s = talkStatuses(talks, { date: '2026-09-23', time: '14:00' });
    expect(s.get('b')).toBe('agora');
    expect(s.get('c')).toBe('a-seguir');
  });

  it('às 15:29 ainda está no ar; às 15:30 já passou', () => {
    expect(talkStatuses(talks, { date: '2026-09-23', time: '15:29' }).get('b')).toBe('agora');
    expect(talkStatuses(talks, { date: '2026-09-23', time: '15:30' }).get('b')).toBe('passou');
  });

  it('outro dia não recebe "a seguir", mesmo sendo a próxima no tempo', () => {
    const s = talkStatuses(talks, { date: '2026-09-23', time: '19:00' });
    expect(s.get('e')).toBe('depois');
    expect(s.get('f')).toBe('passou');
  });
});

describe('fase e rótulos', () => {
  const ev = { startDate: '2026-09-22', endDate: '2026-09-25' };

  it('fase pelo dia de hoje, com as pontas dentro', () => {
    expect(eventPhase(ev, '2026-09-21')).toBe('proximo');
    expect(eventPhase(ev, '2026-09-22')).toBe('acontecendo');
    expect(eventPhase(ev, '2026-09-25')).toBe('acontecendo');
    expect(eventPhase(ev, '2026-09-26')).toBe('encerrado');
  });

  it('chip: em 8 dias, amanhã, hoje, encerrado', () => {
    expect(phaseLabel(ev, '2026-09-14')).toBe('Em 8 dias');
    expect(phaseLabel(ev, '2026-09-21')).toBe('Amanhã');
    expect(phaseLabel(ev, '2026-09-23')).toBe('Hoje');
    expect(phaseLabel(ev, '2026-09-30')).toBe('Encerrado');
  });

  it('período por extenso', () => {
    expect(formatPeriod('2026-09-22', '2026-09-25')).toBe('22 a 25 de setembro');
    expect(formatPeriod('2026-09-30', '2026-10-02')).toBe('30 de setembro a 2 de outubro');
    expect(formatPeriod('2026-11-10', '2026-11-10')).toBe('10 de novembro');
    expect(coverDateBox('2026-09-22', '2026-09-25')).toEqual({ dias: '22–25', mes: 'set 2026' });
  });

  it('site sem https não vira link relativo dentro do app', () => {
    expect(websiteUrl('jpdetail.com.br')).toBe('https://jpdetail.com.br');
    expect(websiteUrl('http://x.com')).toBe('http://x.com');
    expect(websiteUrl(' ')).toBeNull();
  });
});

describe('.ics', () => {
  const agora = new Date('2026-09-14T13:00:00Z');

  it('escapa vírgula, ponto e vírgula, barra e quebra de linha', () => {
    expect(icsEscape('pH, diluição; rótulo\\n\nfim')).toBe('pH\\, diluição\\; rótulo\\\\n\\nfim');
  });

  it('dobra linha longa em 75 octetos, contando acento como dois', () => {
    const dobrada = icsFold('DESCRIPTION:' + 'ã'.repeat(60));
    for (const linha of dobrada.split('\r\n')) {
      expect(new TextEncoder().encode(linha).length).toBeLessThanOrEqual(75);
    }
    expect(dobrada.split('\r\n').slice(1).every(l => l.startsWith(' '))).toBeTrue();
  });

  it('palestra: horário de parede em São Paulo, local resolvido e palestrantes na descrição', () => {
    const t = talk('t-1', '2026-09-23', '14:00', '15:30', {
      title: 'Descontaminação de pintura, na prática',
      room: 'Oficina',
      speakers: [{ id: 's', name: 'João Pedro Lima' } as any],
      location: poseidon.location,
    });

    // Desdobra antes de procurar: linha longa vem quebrada em 75 octetos, como a RFC manda.
    const ics = icsForTalk(poseidon, t, agora).replace(/\r\n /g, '');

    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20260923T140000');
    expect(ics).toContain('DTEND;TZID=America/Sao_Paulo:20260923T153000');
    expect(ics).toContain('UID:t-1@proautokimium.com.br');
    expect(ics).toContain('SUMMARY:Descontaminação de pintura\\, na prática · Poseidon Week');
    expect(ics).toContain('DESCRIPTION:Com João Pedro Lima');
    expect(ics).toContain('LOCATION:Proauto Kimium · Oficina · Av. Colombo\\, 5790 - Zona 7\\, Maringá - PR');
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics.includes('\r\n')).toBeTrue();
  });

  it('evento sem palestra ainda baixa um bloco de dia inteiro, e não um arquivo vazio', () => {
    const ics = icsForEvent(poseidon, agora);

    expect(ics).toContain('DTSTART;VALUE=DATE:20260922');
    // DTEND de dia inteiro é exclusivo: termina no dia seguinte ao último.
    expect(ics).toContain('DTEND;VALUE=DATE:20260926');
  });

  it('evento com palestras tem um VEVENT por palestra', () => {
    const ics = icsForEvent({ ...poseidon, talks: [talk('a', '2026-09-22', '09:00', '10:00'), talk('b', '2026-09-23', '09:00', '10:00')] }, agora);

    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(2);
  });

  it('link do Google Agenda com horário de parede e fuso', () => {
    const url = new URL(googleCalendarLink(poseidon, talk('a', '2026-09-23', '14:00', '15:30')));

    expect(url.searchParams.get('dates')).toBe('20260923T140000/20260923T153000');
    expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo');
    expect(url.searchParams.get('location')).toContain('Av. Colombo');
  });
});
