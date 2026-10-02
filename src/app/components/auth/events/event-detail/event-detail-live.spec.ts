import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventDetailComponent } from './event-detail.component';
import { EventDetail } from '../../../../domain/models/events.model';
import { SaoPauloNow } from '../../../../domain/utils/events';
import { providersDeTeste } from '../../../../../testing/test-setup';

const LIVE: EventDetail = {
  id: 'live-1', name: 'Alinhamento semanal', description: null, startDate: '2026-10-08', endDate: '2026-10-08',
  coverUrl: null, locationType: 'ONLINE',
  location: { source: 'ONLINE', companyId: null, name: null, address: null, onlineUrl: 'https://www.youtube.com/live/abc' },
  publishedAt: '2026-10-05T10:00:00', updatedAt: null, updatedBy: null, talks: [], startsAt: '2026-10-08T09:00:00',
  settings: null, startTime: '09:00:00', endTime: '09:40:00', endsAt: '2026-10-08T09:40:00', answersUntil: '2026-10-08T09:40:00',
};

describe('EventDetailComponent · live', () => {
  let fixture: ComponentFixture<EventDetailComponent>;

  async function montar(now: SaoPauloNow): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [EventDetailComponent], providers: providersDeTeste() }).compileComponents();
    fixture = TestBed.createComponent(EventDetailComponent);
    fixture.componentRef.setInput('event', LIVE);
    fixture.componentRef.setInput('now', now);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const assistir = (el: HTMLElement) => el.querySelector('[data-testid="assistir"]') as HTMLAnchorElement;

  it('antes: o link já funciona, com a plataforma e o horário', async () => {
    const el = await montar({ date: '2026-10-06', time: '10:00' });

    expect(el.querySelector('[data-testid="live"]')!.textContent).toContain('YouTube');
    expect(assistir(el).textContent).toContain('Abrir a transmissão');
    expect(assistir(el).getAttribute('href')).toBe('https://www.youtube.com/live/abc');
  });

  /**
   * Abre fora do ERP e sem dar à página aberta acesso a esta (noopener) nem o
   * endereço do ERP (noreferrer).
   */
  it('o botão abre em outra aba, sem noopener/noreferrer faltando', async () => {
    const el = await montar({ date: '2026-10-06', time: '10:00' });

    expect(assistir(el).getAttribute('target')).toBe('_blank');
    expect(assistir(el).getAttribute('rel')).toContain('noopener');
    expect(assistir(el).getAttribute('rel')).toContain('noreferrer');
  });

  it('durante: "Assistir agora" e o selo Ao vivo', async () => {
    const el = await montar({ date: '2026-10-08', time: '09:05' });

    expect(assistir(el).textContent).toContain('Assistir agora');
    expect(el.querySelector('[data-testid="live"]')!.classList).toContain('live--ao-vivo');
  });

  it('depois: diz que terminou, e o link continua lá', async () => {
    const el = await montar({ date: '2026-10-08', time: '11:00' });

    expect(el.querySelector('[data-testid="live"]')!.textContent).toContain('terminou às 09:40');
    expect(assistir(el).getAttribute('href')).toBe('https://www.youtube.com/live/abc');
  });

  it('live sem palestras não mostra a programação vazia nem o mapa', async () => {
    const el = await montar({ date: '2026-10-06', time: '10:00' });

    expect(el.querySelector('[data-testid="aba-dia"]')).toBeNull();
    expect(el.textContent).not.toContain('Nenhuma palestra');
    expect(el.querySelector('app-map-preview')).toBeNull();
  });
});
