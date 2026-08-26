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
import {
  CalendarDayEvent,
  CalendarLegendItem,
  CalendarTone,
  PkCalendarComponent,
} from '../../../theme/ProautoKimium/pk-calendar/pk-calendar.component';

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
 * Máquina no galpão sem data de saída.
 *
 * `diasParada` vem da auditoria, e é o que faz a lista valer: um nome sozinho
 * não diz nada, "há 40 dias sem previsão" diz. Sem `createdAt` — registro
 * importado antes da V74 — fica nulo e a linha não mente inventando idade.
 */
interface Parada {
  register: MachineRegister;
  machine: string;
  diasParada: number | null;
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
  imports: [CommonModule, RouterLink, PageHeaderComponent, PkDialogComponent, PkCalendarComponent],
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

  /**
   * O complemento de "Próximas saídas": o que está parado.
   *
   * Aquela lista filtra por **ter** previsão; esta pega justamente quem não
   * tem. São as máquinas fisicamente no galpão sem compromisso — o hub mostrava
   * só o que ia sair, e nunca o que estava encalhado.
   *
   * `ENTREGUE` fica de fora porque já saiu: sem previsão e entregue não é
   * máquina parada, é registro histórico.
   *
   * Mais antiga no topo. Uma máquina sem previsão há dois meses é o problema;
   * a que chegou ontem ainda não é.
   */
  readonly paradas = computed<Parada[]>(() => {
    const hoje = startOfToday();

    return this.registerStore.items()
      .filter(register => !register.previsaoEntrega && register.status !== MachineStatus.ENTREGUE)
      .map(register => {
        const desde = parseDateOnly(register.createdAt ?? null);
        return {
          register,
          machine: this.machineStore.nameOf(register.machineId),
          diasParada: desde
            ? Math.round((hoje.getTime() - desde.getTime()) / 86_400_000)
            : null,
        };
      })
      .sort((a, b) => (b.diasParada ?? -1) - (a.diasParada ?? -1));
  });

  // ─── Carga por consultor ──────────────────────────────────────────────────
  //
  // `consultor` já vem na programação e o hub não usava. Responde a pergunta
  // que aparece toda semana — "quem está com a máquina do cliente X?" — sem
  // nenhuma chamada nova: a lista inteira já está no store.

  readonly consultantLoad = computed<ConsultantLoad[]>(() => {
    const byConsultant = new Map<string, ConsultantLoad>();

    for (const register of this.registerStore.items()) {
      // Entregue saiu da mão de todo mundo. Carga é o que ainda pesa.
      if (register.status === MachineStatus.ENTREGUE) continue;

      const name = register.consultor?.trim() || 'Sem consultor';
      const entry = byConsultant.get(name)
        ?? { name, open: 0, late: 0 };

      entry.open += 1;
      if (isLate(register)) entry.late += 1;

      byConsultant.set(name, entry);
    }

    return [...byConsultant.values()].sort((a, b) => b.open - a.open);
  });

  readonly totalOpen = computed(() =>
    this.consultantLoad().reduce((total, entry) => total + entry.open, 0));

  /** A barra é relativa a quem tem mais, não ao total — comparar é o ponto. */
  readonly loadWidth = computed(() => {
    const most = this.consultantLoad()[0]?.open ?? 0;
    return (open: number) => (most ? Math.round((open / most) * 100) : 0);
  });

  // ─── Calendário de implantações ───────────────────────────────────────────
  //
  // Mesmo desenho do Painel de RH, mas sem ir ao servidor a cada mês: a
  // programação inteira já está no store, então virar o mês é só refiltrar o
  // que está em memória.

  readonly displayedMonth = signal(startOfMonth(new Date()));

  /**
   * As cores da legenda são as mesmas severidades dos chips de status da
   * Programação — quem vê o quadro lá reconhece aqui sem reaprender.
   */
  readonly calendarLegend: CalendarLegendItem[] = [
    { tone: 'success', label: 'Disponível' },
    { tone: 'warning', label: 'Reforma / liberar equipamentos' },
    { tone: 'danger', label: 'Aguardando aquisição' },
    { tone: 'neutral', label: 'Entregue / reservada' },
    { alert: true, label: 'Previsão vencida sem entrega' },
  ];

  /**
   * O que o calendário desenha.
   *
   * Vai a lista inteira, sem recortar pelo mês: o componente indexa por dia e
   * virar o mês passa a ser leitura de um `Map` que já existe, em vez de um
   * recálculo a cada clique.
   */
  readonly calendarEvents = computed<CalendarDayEvent[]>(() =>
    [...this.entriesByDay().values()].flat().map(entry => ({
      date: parseDateOnly(entry.register.previsaoEntrega)!,
      label: entry.label,
      tone: entry.severity as CalendarTone,
      detail: `${entry.machine} · ${entry.statusLabel}`,
      alert: entry.late,
    })));

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

  /**
   * Quantas implantações caem no mês aberto — o número do cabeçalho.
   *
   * Contava varrendo as 42 células da grade; agora que a grade mora no
   * componente, conta pelas previsões direto. Mesmo número, sem depender do
   * desenho.
   */
  readonly monthCount = computed(() => {
    const month = this.displayedMonth();
    return this.calendarEvents().filter(event =>
      event.date.getMonth() === month.getMonth()
      && event.date.getFullYear() === month.getFullYear()).length;
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

  /** O mesmo rótulo que o calendário usa, agora também na lista de paradas. */
  statusLabel(status: MachineStatus): string {
    return MACHINE_STATUS_LABEL[status] ?? status;
  }

  paradaLabel(item: Parada): string {
    if (item.diasParada === null) return 'Sem data de entrada';
    if (item.diasParada <= 0) return 'Entrou hoje';
    if (item.diasParada === 1) return 'Há 1 dia';
    return `Há ${item.diasParada} dias`;
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

/** Quantas máquinas em aberto cada consultor carrega, e quantas já atrasaram. */
interface ConsultantLoad {
  name: string;
  open: number;
  late: number;
}

/**
 * Previsão vencida e a máquina não saiu.
 *
 * Mesmo critério do chip do calendário: sem previsão não é atraso, é falta de
 * programação — e essa lista já existe separada.
 */
function isLate(register: MachineRegister): boolean {
  const previsao = parseDateOnly(register.previsaoEntrega);
  return !!previsao
    && previsao < startOfToday()
    && register.status !== MachineStatus.ENTREGUE;
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
