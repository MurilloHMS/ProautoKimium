import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventDetailComponent } from './event-detail.component';
import { EventDetail, EventTalk } from '../../../../domain/models/events.model';
import { SaoPauloNow } from '../../../../domain/utils/events';

import { providersDeTeste } from '../../../../../testing/test-setup';

function talk(id: string, date: string, ini: string, fim: string, extra: Partial<EventTalk> = {}): EventTalk {
  return {
    id, title: `Palestra ${id}`, description: null, date, startTime: `${ini}:00`, endTime: `${fim}:00`, room: null,
    locationType: 'EVENT', location: null,
    speakers: [{ id: `s-${id}`, name: 'Marina Alves', role: 'Química', companyName: null, photoUrl: null, instagram: 'marina.quimica',
      linkedin: null, website: null, talkCount: 1, updatedAt: null, updatedBy: null }],
    ...extra,
  };
}

/** Poseidon Week, 22 a 25/09/2026. */
const POSEIDON: EventDetail = {
  id: 'ev-1', name: 'Poseidon Week', description: null, startDate: '2026-09-22', endDate: '2026-09-25', coverUrl: null,
  locationType: 'ADDRESS',
  location: { source: 'ADDRESS', companyId: null, name: 'Proauto Kimium',
    address: { zipCode: null, street: 'Av. Colombo', number: '5790', complement: null, district: null, city: 'Maringá', state: 'PR', formatted: 'Av. Colombo, 5790, Maringá - PR' } },
  publishedAt: '2026-09-14T10:00:00', updatedAt: null, updatedBy: null,
  talks: [
    talk('manha', '2026-09-23', '09:00', '10:30'),
    talk('tarde', '2026-09-23', '14:00', '15:30'),
    talk('fim', '2026-09-23', '16:00', '17:00'),
    talk('cliente', '2026-09-23', '17:30', '18:30', {
      locationType: 'ADDRESS',
      location: { source: 'ADDRESS', companyId: null, name: 'Lava Rápido Estrela',
        address: { zipCode: null, street: 'R. Néo Alves Martins', number: '2100', complement: null, district: 'Centro', city: 'Maringá', state: 'PR', formatted: 'R. Néo Alves Martins, 2100 - Centro, Maringá - PR' } },
    }),
    talk('quinta', '2026-09-24', '09:00', '11:00'),
  ],
};

describe('EventDetailComponent', () => {
  let fixture: ComponentFixture<EventDetailComponent>;

  async function montar(now: SaoPauloNow, evento: EventDetail = POSEIDON): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(EventDetailComponent);
    fixture.componentRef.setInput('event', evento);
    fixture.componentRef.setInput('now', now);
    await fixture.whenStable();
  }

  const el = (id: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`)];
  const abaAtiva = () => el('aba-dia').find(b => b.getAttribute('aria-selected') === 'true')?.textContent ?? '';

  it('tem uma aba por dia, de 22 a 25', async () => {
    await montar({ date: '2026-09-14', time: '10:00' });

    expect(el('aba-dia').length).toBe(4);
  });

  it('dentro do evento, abre na aba de hoje', async () => {
    await montar({ date: '2026-09-24', time: '10:00' });

    expect(abaAtiva()).toContain('24');
    expect(abaAtiva()).toContain('Hoje');
  });

  it('antes do evento, abre no primeiro dia', async () => {
    await montar({ date: '2026-09-14', time: '10:00' });

    expect(abaAtiva()).toContain('22');
  });

  it('às 14:20, a palestra das 14:00 está no ar e a das 16:00 é a seguinte', async () => {
    await montar({ date: '2026-09-23', time: '14:20' });

    const agora = el('chip-agora');
    expect(agora.length).toBe(1);
    expect(agora[0].closest('[data-testid="palestra"]')!.textContent).toContain('Palestra tarde');
    expect(el('chip-seguir')[0].closest('[data-testid="palestra"]')!.textContent).toContain('Palestra fim');
  });

  it('o "agora" anda sozinho quando o relógio muda, sem recarregar', async () => {
    await montar({ date: '2026-09-23', time: '14:20' });

    fixture.componentRef.setInput('now', { date: '2026-09-23', time: '15:30' });
    await fixture.whenStable();

    expect(el('chip-agora').length).toBe(0);
    expect(el('chip-seguir')[0].closest('[data-testid="palestra"]')!.textContent).toContain('Palestra fim');
  });

  it('clicar noutra aba mostra as palestras daquele dia', async () => {
    await montar({ date: '2026-09-23', time: '14:20' });

    el('aba-dia').find(b => b.textContent!.includes('24'))!.click();
    await fixture.whenStable();

    expect(el('palestra').map(p => p.textContent)).toEqual([jasmine.stringContaining('Palestra quinta')]);
  });

  it('palestra fora da empresa mostra o endereço, o "como chegar" e o mapa', async () => {
    await montar({ date: '2026-09-23', time: '10:00' });

    const fora = el('palestra-fora');
    expect(fora.length).toBe(1);
    expect(fora[0].textContent).toContain('R. Néo Alves Martins, 2100');
    const card = fora[0].closest('[data-testid="palestra"]')!;
    expect(card.querySelector('app-directions-menu')).not.toBeNull();
    const iframe = card.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.src).toContain('output=embed');
    expect(iframe.src).toContain('Alves%20Martins');
  });

  it('palestra no local do evento não repete o mapa', async () => {
    await montar({ date: '2026-09-23', time: '10:00' });

    const manha = el('palestra').find(p => p.textContent!.includes('Palestra manha'))!;
    expect(manha.querySelector('iframe')).toBeNull();
  });

  it('o Instagram vira link para o perfil', async () => {
    await montar({ date: '2026-09-23', time: '10:00' });

    const link = fixture.nativeElement.querySelector('a[aria-label="Instagram de Marina Alves"]') as HTMLAnchorElement;
    expect(link.href).toBe('https://www.instagram.com/marina.quimica/');
  });

  it('no "Ver como fica" de um rascunho, avisa que ninguém vê ainda', async () => {
    await montar({ date: '2026-09-14', time: '10:00' }, { ...POSEIDON, publishedAt: null });
    fixture.componentRef.setInput('preview', true);
    await fixture.whenStable();

    expect(el('aviso-rascunho').length).toBe(1);
  });
});
