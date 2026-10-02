import type { EventDetail } from '../models/events.model';
import { icsForEvent, isSafeLiveUrl, livePlatform, liveState } from './events';

describe('lives · plataforma, link e momento', () => {

  it('reconhece a plataforma pelo host', () => {
    expect(livePlatform('https://www.instagram.com/proautokimium/live').name).toBe('Instagram');
    expect(livePlatform('https://youtu.be/abc').name).toBe('YouTube');
    expect(livePlatform('https://www.youtube.com/live/abc').name).toBe('YouTube');
    expect(livePlatform('https://www.linkedin.com/events/123').name).toBe('LinkedIn');
    expect(livePlatform('https://meet.google.com/abc-defg-hij').name).toBe('Google Meet');
    expect(livePlatform('https://teams.microsoft.com/l/meetup-join/x').name).toBe('Microsoft Teams');
    expect(livePlatform('https://empresa.zoom.us/j/123').name).toBe('Zoom');
    expect(livePlatform('https://transmissao.empresa.com.br/ao-vivo').name).toBe('Link externo');
  });

  /** O selo de uma plataforma conhecida dá confiança; não pode ser comprado com texto no link. */
  it('não se deixa enganar por "youtube.com" fora do host', () => {
    expect(livePlatform('https://golpe.com/?u=youtube.com').name).toBe('Link externo');
    expect(livePlatform('https://youtube.com.golpe.com/live').name).toBe('Link externo');
    expect(livePlatform('https://naoyoutube.com/live').name).toBe('Link externo');
  });

  it('link seguro é só https com um host de verdade — a mesma régua da API', () => {
    expect(isSafeLiveUrl('https://www.youtube.com/live/abc')).toBeTrue();
    expect(isSafeLiveUrl('  https://meet.google.com/x  ')).toBeTrue();
    expect(isSafeLiveUrl('http://www.youtube.com/live/abc')).toBeFalse();
    expect(isSafeLiveUrl('javascript:alert(1)')).toBeFalse();
    expect(isSafeLiveUrl('www.youtube.com/live/abc')).toBeFalse();
    expect(isSafeLiveUrl('https://localhost/x')).toBeFalse();
    expect(isSafeLiveUrl('')).toBeFalse();
  });

  it('antes, ao vivo e encerrada, no minuto exato das bordas', () => {
    const ini = '2026-10-08T09:00:00';
    const fim = '2026-10-08T09:40:00';
    expect(liveState(ini, fim, { date: '2026-10-08', time: '08:59' })).toBe('antes');
    expect(liveState(ini, fim, { date: '2026-10-08', time: '09:00' })).toBe('ao-vivo');
    expect(liveState(ini, fim, { date: '2026-10-08', time: '09:39' })).toBe('ao-vivo');
    expect(liveState(ini, fim, { date: '2026-10-08', time: '09:40' })).toBe('encerrada');
    expect(liveState(ini, fim, { date: '2026-10-07', time: '23:59' })).toBe('antes');
  });

  it('a live entra na agenda com horário e o link, e não como dia inteiro', () => {
    const live: EventDetail = {
      id: 'live-1', name: 'Alinhamento semanal', description: null, startDate: '2026-10-08', endDate: '2026-10-08',
      coverUrl: null, locationType: 'ONLINE',
      location: { source: 'ONLINE', companyId: null, name: null, address: null, onlineUrl: 'https://meet.google.com/abc' },
      publishedAt: '2026-10-05T10:00:00', updatedAt: null, updatedBy: null, talks: [], startsAt: '2026-10-08T09:00:00',
      settings: null, startTime: '09:00:00', endTime: '09:40:00', endsAt: '2026-10-08T09:40:00', answersUntil: '2026-10-08T09:40:00',
    };

    const ics = icsForEvent(live, new Date('2026-10-06T12:00:00Z'));

    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261008T090000');
    expect(ics).toContain('DTEND;TZID=America/Sao_Paulo:20261008T094000');
    expect(ics).toContain('URL:https://meet.google.com/abc');
    expect(ics).not.toContain('VALUE=DATE');
  });
});
