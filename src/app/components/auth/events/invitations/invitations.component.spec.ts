import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, Routes } from '@angular/router';

import { InvitationsComponent } from './invitations.component';
import { EventSummary, Invitation } from '../../../../domain/models/events.model';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';
import { routes } from '../../../../app.routes';

const API = `${environment.apiUrl}/events`;

function resumo(id: string, nome: string, inicio: string): EventSummary {
  return { id, name: nome, startDate: inicio, endDate: inicio, coverUrl: null, location: null, talkCount: 1,
    awayTalkCount: 0, publishedAt: '2026-09-20T09:00:00', updatedAt: null, updatedBy: null, startTime: null, endTime: null };
}

function convite(id: string, nome: string, inicio: string, open: boolean, answer: Invitation['answer'] = null): Invitation {
  return { event: resumo(id, nome, inicio), startsAt: `${inicio}T08:00:00`, open, answer };
}

describe('InvitationsComponent', () => {
  let fixture: ComponentFixture<InvitationsComponent>;
  let http: HttpTestingController;

  // `http` só existe depois de montar; o teste da rota não monta nada.
  afterEach(() => http?.verify());

  async function montar(lista: Invitation[]): Promise<void> {
    await TestBed.configureTestingModule({ imports: [InvitationsComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvitationsComponent);
    fixture.detectChanges();
    http.expectOne(`${API}/invitations`).flush(lista);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const texto = () => fixture.nativeElement.textContent as string;

  it('a rota não pede código de tela: ser convidado basta', () => {
    const todas = (lista: Routes): Routes => lista.flatMap(r => [r, ...todas(r.children ?? [])]);
    const rota = todas(routes).find(r => r.path === 'convites');
    expect(rota).toBeDefined();
    expect(rota!.data?.['screen']).toBeUndefined();
  });

  it('os abertos primeiro, e cada um diz a situação', async () => {
    await montar([
      convite('a', 'Confraternização', '2026-09-12', false, null),
      convite('b', 'Poseidon Week', '2026-10-06', true, null),
      convite('c', 'Treinamento', '2026-10-24', true,
        { answer: 'GOING', note: null, firstAnsweredAt: '2026-09-30T10:00:00', answeredAt: '2026-09-30T10:00:00' }),
    ]);

    const cards = [...fixture.nativeElement.querySelectorAll('[data-testid="convite"]')].map((c: Element) => c.textContent!);
    expect(cards[0]).toContain('Poseidon Week');
    expect(cards[0]).toContain('Aguardando sua resposta');
    expect(cards[1]).toContain('Você vai');
    expect(cards[2]).toContain('Confraternização');
    expect(cards[2]).toContain('Sem resposta');
  });

  it('abrir pelo link do lembrete carrega o convite e conta a visualização', async () => {
    await montar([convite('b', 'Poseidon Week', '2026-10-06', true)]);

    await TestBed.inject(Router).navigate([], { queryParams: { evento: 'b' } });
    await fixture.whenStable();

    http.expectOne(`${API}/invitations/b`).flush({
      event: { ...resumo('b', 'Poseidon Week', '2026-10-06'), description: null, locationType: null, talks: [],
        startsAt: '2026-10-06T08:00:00', settings: null,
        endsAt: '2026-10-07T00:00:00', answersUntil: '2026-10-06T08:00:00' },
      startsAt: '2026-10-06T08:00:00', open: true, answer: null,
    });
    const view = http.expectOne(`${API}/b/views`);
    expect(view.request.method).toBe('POST');
    view.flush(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="rsvp"]')).not.toBeNull();
    expect(texto()).toContain('Você ainda não respondeu');
  });

  it('convite que não é da pessoa: aviso, e nenhuma visualização', async () => {
    await montar([]);

    await TestBed.inject(Router).navigate([], { queryParams: { evento: 'x' } });
    await fixture.whenStable();
    http.expectOne(`${API}/invitations/x`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="nao-encontrado"]')).not.toBeNull();
    http.expectNone(`${API}/x/views`);
  });
});
