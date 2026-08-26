import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { CalendarDayEvent, PkCalendarComponent } from './pk-calendar.component';

/**
 * O calendário compartilhado.
 *
 * O que estes testes protegem é o que a extração pôs em risco: as duas telas
 * agora dependem do mesmo código, e um erro aqui quebra o Hub das Máquinas e o
 * Painel de RH ao mesmo tempo.
 */
describe('PkCalendarComponent', () => {
  let component: PkCalendarComponent;
  let fixture: ComponentFixture<PkCalendarComponent>;

  const event = (day: number, label: string): CalendarDayEvent => ({
    date: new Date(2026, 8, day),          // setembro de 2026
    label,
    tone: 'success',
  });

  beforeEach(async () => {
    try { window.localStorage.clear(); } catch { /* aba anônima */ }

    await TestBed.configureTestingModule({
      imports: [PkCalendarComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(PkCalendarComponent);
    component = fixture.componentInstance;
  });

  const withEvents = (events: CalendarDayEvent[]) => {
    fixture.componentRef.setInput('events', events);
    component.displayedMonth.set(new Date(2026, 8, 1));
  };

  // ─── A grade ──────────────────────────────────────────────────────────────

  /**
   * Setembro de 2026 começa numa terça e tem 30 dias: 2 + 30 = 32, que passa de
   * quatro semanas. Um mês que começa no domingo e tem 28 dias caberia em
   * quatro — e o cálculo tem que dar os dois.
   */
  it('monta seis semanas quando o mês precisa e cinco quando cabe', () => {
    component.displayedMonth.set(new Date(2026, 8, 1));
    expect(component.weeks().length).toBe(5);

    // Agosto de 2026 começa num sábado e tem 31 dias: 6 + 31 = 37, seis semanas.
    component.displayedMonth.set(new Date(2026, 7, 1));
    expect(component.weeks().length).toBe(6);
  });

  it('a grade começa no domingo e cobre o mês inteiro', () => {
    component.displayedMonth.set(new Date(2026, 8, 1));
    const days = component.weeks().flat();

    expect(days[0].getDay()).toBe(0);
    expect(days.filter(day => day.getMonth() === 8).length).toBe(30);
  });

  it('agrupa os itens por dia', () => {
    withEvents([event(10, 'Um'), event(10, 'Dois'), event(15, 'Três')]);

    expect(component.eventsFor(new Date(2026, 8, 10)).length).toBe(2);
    expect(component.eventsFor(new Date(2026, 8, 15)).length).toBe(1);
    expect(component.eventsFor(new Date(2026, 8, 11)).length).toBe(0);
  });

  // ─── A navegação ──────────────────────────────────────────────────────────

  /**
   * **A razão de o componente não guardar dado.**
   *
   * O Painel de RH busca as férias do mês no servidor a cada virada. Sem este
   * aviso ele mostraria o mês novo com os dados do mês velho — e nada quebraria
   * de forma visível.
   */
  it('avisa quando o mês vira', () => {
    const meses: Date[] = [];
    component.monthChange.subscribe(month => meses.push(month));

    component.displayedMonth.set(new Date(2026, 8, 1));
    component.nextMonth();
    component.prevMonth();
    component.goToday();

    expect(meses.length).toBe(3);
    expect(meses[0].getMonth()).toBe(9);
    expect(meses[1].getMonth()).toBe(8);
  });

  it('virar o ano anda para dezembro e não para o mês -1', () => {
    component.displayedMonth.set(new Date(2026, 0, 1));
    component.prevMonth();

    expect(component.displayedMonth().getMonth()).toBe(11);
    expect(component.displayedMonth().getFullYear()).toBe(2025);
  });

  // ─── A agenda ─────────────────────────────────────────────────────────────

  it('a agenda lista só os dias com item, em ordem', () => {
    withEvents([event(15, 'Três'), event(3, 'Um'), event(10, 'Dois')]);

    expect(component.agendaDays().map(day => day.date.getDate())).toEqual([3, 10, 15]);
  });

  /** A agenda é outra vista do mês aberto, não uma lista infinita. */
  it('a agenda ignora item de outro mês', () => {
    withEvents([
      event(10, 'Deste mês'),
      { date: new Date(2026, 9, 5), label: 'Do mês que vem', tone: 'success' },
    ]);

    expect(component.agendaDays().length).toBe(1);
    expect(component.agendaDays()[0].events[0].label).toBe('Deste mês');
  });

  /** A barrinha devolve a única coisa que a agenda perde da grade. */
  it('a barrinha marca os dias ocupados do mês', () => {
    withEvents([event(3, 'Um'), event(10, 'Dois')]);

    const strip = component.monthStrip();
    expect(strip.length).toBe(30);
    expect(strip.filter(slot => slot.busy).map(slot => slot.day)).toEqual([3, 10]);
  });

  // ─── A memória da escolha ─────────────────────────────────────────────────

  /**
   * **O bug que quase passou.**
   *
   * `input()` só tem valor depois que o Angular liga o componente. Lendo a
   * chave no construtor, as duas telas cairiam no padrão `pk-calendar-view` e
   * dividiriam a mesma preferência — sem erro, sem aviso, sem build quebrado.
   */
  it('guarda a escolha na chave da tela, não na padrão', () => {
    fixture.componentRef.setInput('storageKey', 'machine-hub-calendar-view');
    fixture.detectChanges();

    component.setView('agenda');

    expect(window.localStorage.getItem('machine-hub-calendar-view')).toBe('agenda');
    expect(window.localStorage.getItem('pk-calendar-view')).toBeNull();
  });

  it('abre na visão guardada', () => {
    window.localStorage.setItem('rh-hub-calendar-view', 'agenda');

    fixture.componentRef.setInput('storageKey', 'rh-hub-calendar-view');
    fixture.detectChanges();

    expect(component.view()).toBe('agenda');
  });

  /** Valor estranho no storage não pode decidir nada. */
  it('ignora valor inválido guardado', () => {
    window.localStorage.setItem('pk-calendar-view', 'lixo');

    fixture.detectChanges();

    expect(['month', 'agenda']).toContain(component.view());
  });
});
