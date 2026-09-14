import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { EventsViewComponent } from './events-view.component';
import { EventDetail, EventSummary } from '../../../../domain/models/events.model';
import { environment } from '../../../../../environments/environment';

import { providersDeTeste } from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/events`;

function resumo(id: string, nome: string, inicio: string, fim: string): EventSummary {
  return { id, name: nome, startDate: inicio, endDate: fim, coverUrl: null, location: null, talkCount: 3, awayTalkCount: 0,
    publishedAt: '2026-09-01T10:00:00', updatedAt: null, updatedBy: null };
}

describe('EventsViewComponent', () => {
  let fixture: ComponentFixture<EventsViewComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    // 23/09/2026 às 14:20 em São Paulo (17:20 UTC).
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-23T17:20:00Z'));
  });

  afterEach(() => {
    http.verify();
    jasmine.clock().uninstall();
  });

  async function montar(lista: EventSummary[]): Promise<void> {
    await TestBed.configureTestingModule({ imports: [EventsViewComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventsViewComponent);
    fixture.detectChanges();
    http.expectOne(API).flush(lista);
    await fixture.whenStable();
  }

  const texto = () => fixture.nativeElement.textContent as string;

  it('agrupa em acontecendo, próximos (do mais perto) e anteriores', async () => {
    await montar([
      resumo('c', 'Encontro de Distribuidores', '2026-11-10', '2026-11-10'),
      resumo('a', 'Poseidon Week', '2026-09-22', '2026-09-25'),
      resumo('d', 'Treinamento de Aplicadores', '2026-05-12', '2026-05-13'),
      resumo('b', 'Workshop de Vendas', '2026-10-01', '2026-10-01'),
    ]);
    http.expectOne(`${API}/a`).flush({ ...resumo('a', 'Poseidon Week', '2026-09-22', '2026-09-25'), description: null, locationType: null, talks: [] });
    await fixture.whenStable();

    const grupos = [...fixture.nativeElement.querySelectorAll('h2.grupo')].map((h: Element) => h.textContent!.trim());
    expect(grupos).toEqual(['Acontecendo', 'Próximos', 'Anteriores']);

    const cards = [...fixture.nativeElement.querySelectorAll('[data-testid="card-evento"]')].map((c: Element) => c.textContent!);
    expect(cards[1]).toContain('Workshop de Vendas');
    expect(cards[2]).toContain('Encontro de Distribuidores');
  });

  it('mostra o que está no ar agora no evento de hoje', async () => {
    await montar([resumo('a', 'Poseidon Week', '2026-09-22', '2026-09-25')]);

    const detalhe: EventDetail = {
      ...resumo('a', 'Poseidon Week', '2026-09-22', '2026-09-25'), description: null, locationType: null,
      talks: [
        { id: 't1', title: 'Descontaminação de pintura', description: null, date: '2026-09-23', startTime: '14:00:00', endTime: '15:30:00',
          room: null, locationType: 'EVENT', location: null,
          speakers: [{ id: 's', name: 'João Pedro Lima' } as any] },
        { id: 't2', title: 'Painel: detergentes neutros', description: null, date: '2026-09-23', startTime: '16:00:00', endTime: '17:00:00',
          room: null, locationType: 'EVENT', location: null, speakers: [{ id: 's2', name: 'Marina Alves' } as any] },
      ],
    } as EventDetail;
    http.expectOne(`${API}/a`).flush(detalhe);
    await fixture.whenStable();

    const faixa = fixture.nativeElement.querySelector('[data-testid="no-ar"]') as HTMLElement;
    expect(faixa).not.toBeNull();
    expect(faixa.textContent).toContain('Descontaminação de pintura');
    expect(faixa.textContent).toContain('Com João Pedro Lima');
    expect(faixa.textContent).toContain('Painel: detergentes neutros');
  });

  it('sem evento hoje, não busca detalhe nem mostra a faixa', async () => {
    await montar([resumo('c', 'Encontro de Distribuidores', '2026-11-10', '2026-11-10')]);

    expect(fixture.nativeElement.querySelector('[data-testid="no-ar"]')).toBeNull();
  });

  /** Para quem só vê, o rascunho não existe: o link dele cai aqui. */
  it('link de evento que responde 404 avisa, em vez de tela vazia', async () => {
    await montar([]);

    await TestBed.inject(Router).navigate([], { queryParams: { evento: 'rascunho' } });
    http.expectOne(`${API}/rascunho`).flush({ message: 'Evento não encontrado.' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="nao-encontrado"]')).not.toBeNull();
    expect(texto()).toContain('ainda não foi publicado');
  });
});
