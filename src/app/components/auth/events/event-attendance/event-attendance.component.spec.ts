import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { EventAttendanceComponent, formatStampFull } from './event-attendance.component';
import { Attendance, Attendee } from '../../../../domain/models/events.model';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/events`;

function pessoa(nome: string, extra: Partial<Attendee> = {}): Attendee {
  return { employeeId: nome, name: nome, companyName: 'Matriz', departmentName: 'Comercial', invited: true,
    firstViewedAt: null, lastViewedAt: null, viewCount: 0, answer: null, note: null,
    firstAnsweredAt: null, answeredAt: null, ...extra };
}

const ACOMPANHAMENTO: Attendance = {
  eventId: 'ev1', eventName: 'Poseidon Week', startDate: '2026-10-06', endDate: '2026-10-08',
  startsAt: '2026-10-06T08:00:00', reminderEnabled: true, reminderTime: '09:00:00', reminderDaysBefore: 7,
  reminderDays: [
    { day: '2026-09-30', sentAt: '2026-09-30T09:00:01', recipients: 3 },
    { day: '2026-10-01', sentAt: '2026-10-01T09:00:01', recipients: 2 },
  ],
  invited: 3, going: 1, notGoing: 0, noAnswer: 2, neverViewed: 1, acknowledged: 0, online: false,
  attendees: [
    pessoa('Carlos', { viewCount: 2, firstViewedAt: '2026-10-01T09:03:00', lastViewedAt: '2026-10-01T10:00:00' }),
    pessoa('Diego', { viewCount: 1, firstViewedAt: '2026-09-30T08:41:00', lastViewedAt: '2026-09-30T08:41:00',
      answer: 'GOING', note: 'Vou nos dois primeiros dias', answeredAt: '2026-10-01T10:12:00', firstAnsweredAt: '2026-10-01T10:12:00' }),
    pessoa('Juliana'),
    pessoa('Ana', { invited: false, answer: 'NOT_GOING', note: 'Férias', answeredAt: '2026-09-29T14:07:00' }),
  ],
};

describe('EventAttendanceComponent', () => {
  let fixture: ComponentFixture<EventAttendanceComponent>;
  let http: HttpTestingController;

  afterEach(() => http?.verify());

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({ imports: [EventAttendanceComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EventAttendanceComponent);
    fixture.componentRef.setInput('eventId', 'ev1');
    fixture.detectChanges();
    http.expectOne(`${API}/ev1/attendance`).flush(ACOMPANHAMENTO);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const linhas = () => [...fixture.nativeElement.querySelectorAll('[data-testid="linha"]')].map((l: Element) => l.textContent!);
  const filtro = (rotulo: string) => [...fixture.nativeElement.querySelectorAll('[data-testid="filtros"] button')]
    .find((b: Element) => b.textContent!.trim().startsWith(rotulo + ' ·')) as HTMLButtonElement;

  it('o cabeçalho diz o prazo e os dias em que o lembrete saiu', async () => {
    await montar();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Respostas até 06/10, às 08:00');
    expect(texto).toContain('lembrete todo dia às 09:00, a partir de 7 dias antes (enviado 30/09 e 01/10)');
  });

  it('quem saiu do público continua na lista, marcado', async () => {
    await montar();

    expect(linhas().length).toBe(4);
    expect(linhas()[3]).toContain('Ana');
    expect(linhas()[3]).toContain('Saiu do público');
  });

  it('os filtros contam só o público de hoje', async () => {
    await montar();

    filtro('Não vão').click();
    fixture.detectChanges();
    expect(linhas().length).withContext('Ana não vai, mas saiu do público').toBe(0);

    filtro('Sem resposta').click();
    fixture.detectChanges();
    expect(linhas().map(l => l.includes('Carlos') || l.includes('Juliana'))).toEqual([true, true]);

    filtro('Nem abriram').click();
    fixture.detectChanges();
    expect(linhas().length).toBe(1);
    expect(linhas()[0]).toContain('Juliana');
    expect(linhas()[0]).toContain('Nunca abriu');
  });

  it('a planilha leva o ano: ela sai da tela', () => {
    expect(formatStampFull('2026-10-01T09:03:00')).toBe('01/10/2026 09:03');
  });
});
