import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';

/**
 * O vocabulário de cor do calendário.
 *
 * Cobre os dois usos sem que nenhum dos dois precise conhecer o outro: as
 * Máquinas usam as severidades de status, o RH usa os estados de solicitação
 * (`muted` é pendente, `info` é pago). Passar classe CSS em vez de tom traria
 * o estilo de uma tela para dentro do componente.
 */
export type CalendarTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'muted';

/**
 * Um item já resolvido para um dia.
 *
 * `date` é **um** dia: quem tem período — férias no RH — expande antes de
 * entregar. O calendário não sabe o que é um intervalo, e não precisa saber.
 */
export interface CalendarDayEvent {
  date: Date;
  label: string;
  tone: CalendarTone;
  /** Segunda linha na agenda. A grade do mês não tem espaço para ela. */
  detail?: string;
  /** Destaque de atenção — a implantação atrasada. */
  alert?: boolean;
}

/**
 * Um item da legenda.
 *
 * É `input` e não conteúdo projetado por um detalhe do Angular: nó projetado
 * carrega o encapsulamento do **pai**, então `.cal__dot` daqui não o alcançaria
 * e cada tela teria que repetir os estilos da legenda — que é metade do motivo
 * de existir este componente.
 */
export interface CalendarLegendItem {
  label: string;
  tone?: CalendarTone;
  /** O contorno vermelho do atraso, em vez de um disco cheio. */
  alert?: boolean;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function dayKey(date: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Calendário mensal — o mesmo no Hub das Máquinas e no Painel de RH.
 *
 * Estava escrito duas vezes, e as duas cópias já tinham divergido sozinhas: o
 * RH capitalizava o nome do mês, o das Máquinas não; o botão de um mudava de
 * cor no hover, o do outro só de borda. Ninguém decidiu nada disso.
 *
 * **O componente não busca dado.** É a diferença que quase impediu a extração:
 * o RH vai ao servidor a cada mês virado, as Máquinas refiltram o que já está
 * no store. Aqui o mês é estado interno e a virada sai como `monthChange` —
 * cada tela decide se isso é um GET ou um `computed`.
 */
@Component({
  selector: 'pk-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pk-calendar.component.html',
  styleUrl: './pk-calendar.component.scss',
})
export class PkCalendarComponent {

  readonly events = input<CalendarDayEvent[]>([]);
  readonly legend = input<CalendarLegendItem[]>([]);

  /** O mês virou. Quem precisa buscar no servidor escuta isto. */
  readonly monthChange = output<Date>();

  /** Um dia foi tocado. Cada tela abre o próprio diálogo. */
  readonly dayClick = output<Date>();

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly displayedMonth = signal(startOfMonth(new Date()));

  readonly monthLabel = computed(() => {
    const month = this.displayedMonth();
    return `${MONTH_LABELS[month.getMonth()]} de ${month.getFullYear()}`;
  });

  /**
   * Itens indexados por dia.
   *
   * O template pede `eventsFor` uma vez por célula — 42 por render — e varrer a
   * lista inteira em cada uma seria quadrático à toa.
   */
  private readonly eventsByDay = computed(() => {
    const byDay = new Map<string, CalendarDayEvent[]>();

    for (const event of this.events()) {
      const key = dayKey(event.date);
      const list = byDay.get(key);
      if (list) list.push(event);
      else byDay.set(key, [event]);
    }

    return byDay;
  });

  /** Seis semanas quando o mês precisa; cinco quando cabe. */
  readonly weeks = computed<Date[][]>(() => {
    const month = this.displayedMonth();
    const year = month.getFullYear();
    const index = month.getMonth();

    const startWeekday = new Date(year, index, 1).getDay();
    const daysInMonth = new Date(year, index + 1, 0).getDate();
    const cells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    const weeks: Date[][] = [];
    for (let cell = 0; cell < cells; cell += 7) {
      weeks.push(Array.from({ length: 7 }, (_, offset) =>
        new Date(year, index, 1 - startWeekday + cell + offset)));
    }
    return weeks;
  });

  eventsFor(day: Date): CalendarDayEvent[] {
    return this.eventsByDay().get(dayKey(day)) ?? [];
  }

  isCurrentMonth(day: Date): boolean {
    return day.getMonth() === this.displayedMonth().getMonth();
  }

  isToday(day: Date): boolean {
    return dayKey(day) === dayKey(new Date());
  }

  prevMonth(): void {
    this.goToMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  nextMonth(): void {
    this.goToMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  goToday(): void {
    this.goToMonth(() => startOfMonth(new Date()));
  }

  private goToMonth(next: (current: Date) => Date): void {
    this.displayedMonth.update(next);
    this.monthChange.emit(this.displayedMonth());
  }
}
