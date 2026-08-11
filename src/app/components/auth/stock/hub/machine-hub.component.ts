import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
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

interface Slice {
  label: string;
  count: number;
  percent: number;
  severity: string;
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
  imports: [CommonModule, RouterLink, PageHeaderComponent],
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

  readonly available = computed(() => this.byStatus().get(MachineStatus.PRONTA) ?? 0);
  readonly delivered = computed(() => this.byStatus().get(MachineStatus.ENTREGUE) ?? 0);
  readonly inRepair = computed(() =>
    (this.byStatus().get(MachineStatus.REFORMA) ?? 0) + (this.byStatus().get(MachineStatus.MANUTENCAO) ?? 0));

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
