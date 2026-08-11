import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';

import { FuelSupply } from '../../../../../domain/models/fuel-supply.model';
import { FuelSuppyService } from '../../../../../infrastructure/services/company/vehicle/fuelSupply/fuel-suppy.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

interface Slice {
  label: string;
  total: number;
  liters: number;
  count: number;
  percent: number;
}

interface VehicleRow {
  plate: string;
  total: number;
  liters: number;
  km: number;
  count: number;
  /** km/l do veículo no período; `null` quando não dá para calcular. */
  consumption: number | null;
  percent: number;
}

interface MonthBar {
  key: string;
  label: string;
  total: number;
  liters: number;
  percent: number;
}

/**
 * Hub de Abastecimento.
 *
 * Lê `GET api/fuelsupply?start=&end=` e calcula tudo no cliente, como os
 * outros hubs. Os dados chegam por planilha mensal, então o período padrão é
 * de um ano: com 30 dias, um mês ainda não importado deixaria a tela vazia e
 * pareceria defeito.
 *
 * O consumo é recalculado por `km / litros` em vez de usar o `averageKm` da
 * planilha: a média por linha não pode ser somada nem tirada média de médias
 * sem distorcer, e há linhas que vêm sem ela.
 */
@Component({
  selector: 'app-fuel-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, Tooltip, PageHeaderComponent],
  templateUrl: './fuel-hub.component.html',
  styleUrl: './fuel-hub.component.scss',
})
export class FuelHubComponent implements OnInit {

  private readonly service = inject(FuelSuppyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly supplies = signal<FuelSupply[]>([]);

  readonly periodDays = signal(365);
  readonly periodOptions = [30, 90, 365];

  // ─── Indicadores ──────────────────────────────────────────────────────────

  readonly count = computed(() => this.supplies().length);
  readonly totalSpent = computed(() => this.sum(item => item.totalValue));
  readonly totalLiters = computed(() => this.sum(item => item.liters));

  /** Só a quilometragem plausível entra: ver {@link validKm}. */
  readonly totalKm = computed(() => this.sum(item => validKm(item)));

  readonly avgPrice = computed(() => {
    const liters = this.totalLiters();
    return liters > 0 ? this.totalSpent() / liters : 0;
  });

  /**
   * Consumo da frota: km total sobre litros totais. Média de médias daria peso
   * igual a um abastecimento de 5 litros e a um de 60.
   */
  readonly avgConsumption = computed(() => {
    const liters = this.totalLiters();
    return liters > 0 ? this.totalKm() / liters : 0;
  });

  readonly costPerKm = computed(() => {
    const km = this.totalKm();
    return km > 0 ? this.totalSpent() / km : 0;
  });

  readonly vehicleCount = computed(() => new Set(this.supplies().map(item => item.plate)).size);

  // ─── Distribuições ────────────────────────────────────────────────────────

  readonly byDepartment = computed(() => this.groupBy(item => item.department || 'SEM_DEPARTAMENTO'));
  readonly byFuelType = computed(() => this.groupBy(item => item.fuelType || 'Não informado'));

  /** Gasto por mês, para as colunas. */
  readonly byMonth = computed<MonthBar[]>(() => {
    const buckets = new Map<string, { total: number; liters: number }>();

    for (const item of this.supplies()) {
      const key = (item.fuelSupplyDate ?? '').slice(0, 7);
      if (!key) continue;

      const bucket = buckets.get(key) ?? { total: 0, liters: 0 };
      bucket.total += item.totalValue;
      bucket.liters += item.liters;
      buckets.set(key, bucket);
    }

    const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(1, ...rows.map(([, bucket]) => bucket.total));

    return rows.map(([key, bucket]) => ({
      key,
      label: `${key.slice(5, 7)}/${key.slice(2, 4)}`,
      total: bucket.total,
      liters: bucket.liters,
      percent: Math.round((bucket.total / max) * 100),
    }));
  });

  /** Um veículo por placa, do que mais gasta para o que menos gasta. */
  readonly byVehicle = computed<VehicleRow[]>(() => {
    const buckets = new Map<string, VehicleRow>();

    for (const item of this.supplies()) {
      const plate = item.plate || 'Sem placa';
      const row = buckets.get(plate)
        ?? { plate, total: 0, liters: 0, km: 0, count: 0, consumption: null, percent: 0 };

      row.total += item.totalValue;
      row.liters += item.liters;
      row.km += validKm(item);
      row.count += 1;
      buckets.set(plate, row);
    }

    const rows = [...buckets.values()]
      .map(row => ({ ...row, consumption: row.liters > 0 && row.km > 0 ? row.km / row.liters : null }))
      .sort((a, b) => b.total - a.total);

    const max = rows.length ? rows[0].total : 1;
    return rows.map(row => ({ ...row, percent: Math.round((row.total / max) * 100) }));
  });

  readonly topVehicles = computed(() => this.byVehicle().slice(0, 8));

  /**
   * Veículos rodando abaixo da média da frota. É o insight que o relatório em
   * PDF não dá: consumo pior costuma ser manutenção atrasada, não motorista.
   */
  readonly thirsty = computed(() => {
    const fleet = this.avgConsumption();
    if (fleet <= 0) return [];

    return this.byVehicle()
      .filter(row => row.consumption !== null && row.consumption < fleet * 0.85 && row.count >= 3)
      .sort((a, b) => (a.consumption ?? 0) - (b.consumption ?? 0))
      .slice(0, 6);
  });

  /** Últimos abastecimentos, do mais recente para o mais antigo. */
  readonly recent = computed(() =>
    [...this.supplies()]
      .sort((a, b) => (b.fuelSupplyDate ?? '').localeCompare(a.fuelSupplyDate ?? ''))
      .slice(0, 12));

  // ─── Carga ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - this.periodDays() + 1);

    this.service.listByPeriod(dayKey(start), dayKey(end))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.supplies.set(list ?? []);
          this.loading.set(false);
        },
        error: err => {
          this.supplies.set([]);
          this.loading.set(false);
          // 404/405 aqui quer dizer endpoint ausente, não período sem dado.
          this.error.set(err.status === 404 || err.status === 405
            ? 'A API ainda não tem o endpoint de consulta de abastecimentos (GET api/fuelsupply).'
            : 'Não foi possível carregar os abastecimentos.');
        },
      });
  }

  setPeriod(days: number): void {
    this.periodDays.set(days);
    this.load();
  }

  // ─── Formatação ───────────────────────────────────────────────────────────
  // Intl direto em vez do pipe `currency`: o app não registra `LOCALE_ID`, e
  // sem ele o pipe agrupa no padrão americano (R$1,234.50).

  money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  decimal(value: number, digits = 1): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value || 0);
  }

  departmentLabel(value: string): string {
    return (value ?? '').replace(/_/g, ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase());
  }

  private sum(pick: (item: FuelSupply) => number): number {
    return this.supplies().reduce((total, item) => total + (pick(item) || 0), 0);
  }

  private groupBy(key: (item: FuelSupply) => string): Slice[] {
    const buckets = new Map<string, { total: number; liters: number; count: number }>();

    for (const item of this.supplies()) {
      const bucket = buckets.get(key(item)) ?? { total: 0, liters: 0, count: 0 };
      bucket.total += item.totalValue;
      bucket.liters += item.liters;
      bucket.count += 1;
      buckets.set(key(item), bucket);
    }

    const total = this.totalSpent() || 1;
    return [...buckets.entries()]
      .map(([label, bucket]) => ({
        label,
        total: bucket.total,
        liters: bucket.liters,
        count: bucket.count,
        percent: Math.round((bucket.total / total) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }
}

/**
 * Quilometragem confiável de um abastecimento.
 *
 * A planilha traz hodômetro digitado à mão: troca de veículo, zero esquecido e
 * dígito a mais produzem diferenças absurdas ou negativas. Acima de 5.000 km
 * entre dois abastecimentos é erro de digitação, não viagem — e um único
 * desses estraga o consumo da frota inteira.
 */
function validKm(item: FuelSupply): number {
  const km = item.diferenceHodometer;
  return km > 0 && km < 5000 ? km : 0;
}

/** Chave local `2026-08-11`. `toISOString` viraria o dia em fuso negativo. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
