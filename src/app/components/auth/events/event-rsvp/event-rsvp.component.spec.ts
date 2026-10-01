import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { EventRsvpComponent } from './event-rsvp.component';
import { InvitationAnswer } from '../../../../domain/models/events.model';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/events`;

/**
 * A faixa da resposta e o formulário que ela abre. Roda nos dois tamanhos que o
 * Karma pode ter (o iframe de 749px nasce "celular"): os seletores são os mesmos
 * na folha e no diálogo, porque o formulário é um template só.
 */
describe('EventRsvpComponent', () => {
  let fixture: ComponentFixture<EventRsvpComponent>;
  let http: HttpTestingController;

  afterEach(() => http?.verify());

  async function montar(open: boolean, answer: InvitationAnswer | null = null): Promise<void> {
    await TestBed.configureTestingModule({ imports: [EventRsvpComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventRsvpComponent);
    fixture.componentRef.setInput('eventId', 'ev1');
    fixture.componentRef.setInput('startsAt', '2026-10-06T08:00:00');
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('answer', answer);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** A folha e o diálogo podem ir para fora do componente (appendTo body): procura no documento. */
  const el = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const botao = (id: string) => (el(id)?.querySelector('button') ?? el(id)) as HTMLButtonElement | null;
  const opcao = (rotulo: string) => Array.from(document.querySelectorAll('[data-testid="opcoes"] button'))
    .find(b => b.textContent!.trim() === rotulo) as HTMLButtonElement;

  async function abrir(id: string): Promise<void> {
    botao(id)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function digitar(valor: string): void {
    const area = el('nota') as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('sem resposta: a faixa é curta, com o prazo e o botão — o formulário fica fechado', async () => {
    await montar(true);

    expect(el('rsvp')!.textContent).toContain('Você ainda não respondeu');
    expect(el('rsvp')!.textContent).toContain('06/10, às 08:00');
    expect(el('confirmar')).not.toBeNull();
    expect(el('nota')).toBeNull();
  });

  it('confirmar abre o formulário; salvar manda a escolha e a observação aparada', async () => {
    await montar(true);
    let emitida: InvitationAnswer | null = null;
    fixture.componentInstance.answered.subscribe(a => emitida = a);

    await abrir('confirmar');
    expect(botao('salvar')!.disabled).withContext('sem escolha, não salva').toBeTrue();

    opcao('Vou').click();
    digitar('  Vou de carro  ');
    expect(el('contador')!.textContent!.trim()).toBe('16/500');
    expect(el('nota')!.getAttribute('maxlength')).toBe('500');
    botao('salvar')!.click();

    const req = http.expectOne(`${API}/ev1/response`);
    expect(req.request.body).toEqual({ answer: 'GOING', note: 'Vou de carro' });
    req.flush({ answer: 'GOING', note: 'Vou de carro', firstAnsweredAt: '2026-10-01T10:12:00', answeredAt: '2026-10-01T10:12:00' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el('nota')).withContext('o formulário fecha').toBeNull();
    expect(el('resposta')!.textContent).toContain('Você vai');
    expect(el('resposta')!.textContent).toContain('01/10, às 10:12');
    expect(emitida!.answer).toBe('GOING');
  });

  it('respondido e ainda aberto: alterar reabre o formulário preenchido', async () => {
    await montar(true, { answer: 'NOT_GOING', note: 'Férias', firstAnsweredAt: '2026-09-29T14:07:00', answeredAt: '2026-09-29T14:07:00' });

    expect(el('resposta')!.textContent).toContain('Você não vai');
    await abrir('alterar');

    expect(opcao('Não vou').getAttribute('aria-selected')).toBe('true');
    expect((el('nota') as HTMLTextAreaElement).value).toBe('Férias');
  });

  it('depois do início: só leitura, sem botão nenhum', async () => {
    await montar(false, { answer: 'GOING', note: null, firstAnsweredAt: '2026-09-29T14:07:00', answeredAt: '2026-09-29T14:07:00' });

    expect(el('alterar')).toBeNull();
    expect(el('confirmar')).toBeNull();
    expect(el('fechado')).not.toBeNull();
  });

  it('depois do início, sem ter respondido: avisa, e não oferece resposta', async () => {
    await montar(false);

    expect(el('confirmar')).toBeNull();
    expect(el('rsvp')!.textContent).toContain('você não respondeu');
  });

  it('a API recusa porque começou: a mensagem é a do prazo, e o formulário continua aberto', async () => {
    await montar(true);
    await abrir('confirmar');
    opcao('Vou').click();
    fixture.detectChanges();
    botao('salvar')!.click();

    http.expectOne(`${API}/ev1/response`).flush({ message: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(el('erro')!.textContent).toContain('O evento já começou');
  });
});
