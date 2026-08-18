import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_SEVERITY,
  MACHINE_TYPE_LABEL,
  MachineStatus,
  MachineType,
} from '../../../../domain/models/prostock/machine.model';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { parseDateOnly } from '../../../../domain/utils/date-only';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface Slice {
  label: string;
  count: number;
  percent: number;
  severity: string;
}

/** Uma implantação no dia do calendário. */
interface DayEntry {
  register: MachineRegister;
  machine: string;
  label: string;
  statusLabel: string;
  severity: string;
  late: boolean;
}

interface UpcomingExit {
  register: MachineRegister;
  machine: string;
  date: Date;
  daysLeft: number;
  late: boolean;
}

/**
 * Hub das Máquinas.
 *
 * Tudo aqui sai de duas listas que já estão em memória (`MachineStore` e
 * `MachineRegisterStore`) — nenhum endpoint novo, e mudar um status na
 * Programação mexe nestes números na hora.
 *
 * As barras são CSS puro, como no Painel de RH: o projeto não tem biblioteca de
 * gráfico e não vale acrescentar uma por causa de duas distribuições.
 */
@Component({
  selector: 'app-machine-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, PkDialogComponent],
  templateUrl: './machine-hub.component.html',
  styleUrl: './machine-hub.component.scss',
})
export class MachineHubComponent implements OnInit {

  private readonly machineStore = inject(MachineStore);
  private readonly registerStore = inject(MachineRegisterStore);

  readonly loading = computed(() => this.machineStore.loading() || this.registerStore.loading());

  readonly totalMachines = computed(() => this.machineStore.items().length);
  readonly totalRegisters = computed(() => this.registerStore.items().length);

  private readonly byStatus = computed(() => {
    const counts = new Map<MachineStatus, number>();
    for (const register of this.registerStore.items()) {
      counts.set(register.status, (counts.get(register.status) ?? 0) + 1);
    }
    return counts;
  });

  readonly available = computed(() => this.byStatus().get(MachineStatus.DISPONIVEL) ?? 0);
  readonly delivered = computed(() => this.byStatus().get(MachineStatus.ENTREGUE) ?? 0);
  readonly inRepair = computed(() => this.byStatus().get(MachineStatus.REFORMA) ?? 0);

  /** Travado esperando compra — o status que mais empurra entrega para frente. */
  readonly waitingPurchase = computed(() => this.byStatus().get(MachineStatus.AGUARDANDO_AQUISICAO) ?? 0);

  /** Distribuição dos registros por status, do maior para o menor. */
  readonly statusSlices = computed<Slice[]>(() => {
    const total = this.totalRegisters() || 1;
    return [...this.byStatus().entries()]
      .map(([status, count]) => ({
        label: MACHINE_STATUS_LABEL[status] ?? status,
        count,
        percent: Math.round((count / total) * 100),
        severity: MACHINE_STATUS_SEVERITY[status] ?? 'neutral',
      }))
      .sort((a, b) => b.count - a.count);
  });

  /** Distribuição do catálogo por tipo de máquina. */
  readonly typeSlices = computed<Slice[]>(() => {
    const counts = new Map<MachineType, number>();
    for (const machine of this.machineStore.items()) {
      // Máquina é produto: o tipo é opcional e fica nulo em quem foi cadastrado
      // pela tela de produtos sem preencher. Sem tipo, fora da distribuição —
      // um fatia "null" não diria nada a ninguém.
      if (!machine.machineType) continue;
      counts.set(machine.machineType, (counts.get(machine.machineType) ?? 0) + 1);
    }
    const total = this.totalMachines() || 1;

    return [...counts.entries()]
      .map(([type, count]) => ({
        label: MACHINE_TYPE_LABEL[type] ?? type,
        count,
        percent: Math.round((count / total) * 100),
        severity: 'neutral',
      }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Próximas saídas — o insight que a planilha não dá sem ler linha a linha.
   * Entra o que vence nos próximos 7 dias, mais o que já venceu e não saiu.
   */
  readonly upcoming = computed<UpcomingExit[]>(() => {
    const today = startOfToday();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);

    return this.registerStore.items()
      .filter(register => register.status !== MachineStatus.ENTREGUE && register.previsaoEntrega)
      .map(register => {
        const date = parseDateOnly(register.previsaoEntrega)!;
        const daysLeft = Math.round((date.getTime() - today.getTime()) / 86_400_000);
        return {
          register,
          machine: this.machineStore.nameOf(register.machineId),
          date,
          daysLeft,
          late: daysLeft < 0,
        };
      })
      .filter(item => item.date <= limit)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  readonly lateCount = computed(() => this.upcoming().filter(item => item.late).length);

  // ─── Calendário de implantações ───────────────────────────────────────────
  //
  // Mesmo desenho do Painel de RH, mas sem ir ao servidor a cada mês: a
  // programação inteira já está no store, então virar o mês é só refiltrar o
  // que está em memória.

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly displayedMonth = signal(startOfMonth(new Date()));

  readonly monthLabel = computed(() => {
    const month = this.displayedMonth();
    return `${MONTH_LABELS[month.getMonth()]} de ${month.getFullYear()}`;
  });

  /**
   * Previsões indexadas por dia. O template chama `entriesFor` uma vez por
   * célula — 42 buscas por render — e varrer a lista toda em cada uma seria
   * quadrático à toa.
   */
  private readonly entriesByDay = computed(() => {
    const today = startOfToday();
    const byDay = new Map<string, DayEntry[]>();

    for (const register of this.registerStore.items()) {
      const date = parseDateOnly(register.previsaoEntrega);
      if (!date) continue;

      const machine = this.machineStore.nameOf(register.machineId);
      const entry: DayEntry = {
        register,
        machine,
        label: register.nomeCliente?.trim() || machine,
        statusLabel: MACHINE_STATUS_LABEL[register.status] ?? register.status,
        severity: MACHINE_STATUS_SEVERITY[register.status] ?? 'neutral',
        late: date < today && register.status !== MachineStatus.ENTREGUE,
      };

      const key = dayKey(date);
      const list = byDay.get(key);
      if (list) list.push(entry);
      else byDay.set(key, [entry]);
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

  /** Quantas implantações caem no mês aberto — o número do cabeçalho. */
  readonly monthCount = computed(() => {
    const month = this.displayedMonth();
    return this.weeks()
      .flat()
      .filter(day => day.getMonth() === month.getMonth())
      .reduce((total, day) => total + this.entriesFor(day).length, 0);
  });

  readonly dayDialogVisible = signal(false);
  readonly selectedDay = signal<Date | null>(null);

  readonly dayEntries = computed(() => {
    const day = this.selectedDay();
    return day ? this.entriesFor(day) : [];
  });

  entriesFor(day: Date): DayEntry[] {
    return this.entriesByDay().get(dayKey(day)) ?? [];
  }

  isCurrentMonth(day: Date): boolean {
    return day.getMonth() === this.displayedMonth().getMonth();
  }

  isToday(day: Date): boolean {
    return dayKey(day) === dayKey(new Date());
  }

  prevMonth(): void {
    this.displayedMonth.update(month => new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  nextMonth(): void {
    this.displayedMonth.update(month => new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  goToday(): void {
    this.displayedMonth.set(startOfMonth(new Date()));
  }

  openDay(day: Date): void {
    if (this.entriesFor(day).length === 0) return;
    this.selectedDay.set(day);
    this.dayDialogVisible.set(true);
  }

  ngOnInit(): void {
    this.machineStore.load();
    this.registerStore.load();
  }

  refresh(): void {
    this.machineStore.refresh();
    this.registerStore.refresh();
  }

  dueLabel(item: UpcomingExit): string {
    if (item.daysLeft < 0) return `${Math.abs(item.daysLeft)} dia(s) em atraso`;
    if (item.daysLeft === 0) return 'Hoje';
    if (item.daysLeft === 1) return 'Amanhã';
    return `Em ${item.daysLeft} dias`;
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Chave local `2026-08-11`. `toISOString` viraria o dia em fuso negativo. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
