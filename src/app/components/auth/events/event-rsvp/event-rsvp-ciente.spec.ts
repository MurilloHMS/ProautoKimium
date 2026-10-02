import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { EventRsvpComponent } from './event-rsvp.component';
import { InvitationAnswer } from '../../../../domain/models/events.model';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/events`;

/**
 * Na live, a resposta é um toque só: "Estou ciente". Sem formulário, sem
 * observação e sem "alterar".
 */
describe('EventRsvpComponent · Estou ciente', () => {
  let fixture: ComponentFixture<EventRsvpComponent>;
  let http: HttpTestingController;

  afterEach(() => http?.verify());

  async function montar(open: boolean, answer: InvitationAnswer | null = null): Promise<void> {
    await TestBed.configureTestingModule({ imports: [EventRsvpComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventRsvpComponent);
    fixture.componentRef.setInput('eventId', 'live1');
    fixture.componentRef.setInput('startsAt', '2026-10-08T09:00:00');
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('answer', answer);
    fixture.componentRef.setInput('online', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const el = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const botao = (id: string) => (el(id)?.querySelector('button') ?? el(id)) as HTMLButtonElement | null;

  it('mostra "Estou ciente", e não Vou / Não vou', async () => {
    await montar(true);

    expect(el('rsvp-ciente')!.textContent).toContain('Confirme que viu este aviso');
    expect(el('estou-ciente')).not.toBeNull();
    expect(el('confirmar')).toBeNull();
    expect(el('rsvp')).toBeNull();
  });

  it('um toque grava ACKNOWLEDGED sem observação e mostra que está ciente', async () => {
    await montar(true);
    let emitida: InvitationAnswer | null = null;
    fixture.componentInstance.answered.subscribe(a => emitida = a);

    botao('estou-ciente')!.click();
    const req = http.expectOne(`${API}/live1/response`);
    expect(req.request.body).toEqual({ answer: 'ACKNOWLEDGED', note: null });
    const resposta: InvitationAnswer = { answer: 'ACKNOWLEDGED', note: null,
      firstAnsweredAt: '2026-10-06T10:00:00', answeredAt: '2026-10-06T10:00:00' };
    req.flush(resposta);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(emitida!).toEqual(resposta);
    expect(el('ciente')!.textContent).toContain('Você está ciente');
    expect(el('estou-ciente')).toBeNull();
  });

  it('a live acabou sem confirmação: diz que fechou e não oferece o botão', async () => {
    await montar(false);

    expect(el('fechado')!.textContent).toContain('A transmissão terminou');
    expect(el('estou-ciente')).toBeNull();
  });

  it('o 409 da API aparece com a frase dela', async () => {
    await montar(true);

    botao('estou-ciente')!.click();
    http.expectOne(`${API}/live1/response`).flush(
      { message: 'A transmissão já terminou: não dá mais para confirmar.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(el('erro')!.textContent).toContain('A transmissão já terminou');
  });
});
