import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClientNewsletter } from '../../../domain/models/client.model';
import { ClientService } from '../../../infrastructure/services/client/client.service';
import { ClientSessionStore } from '../../../infrastructure/state/client-session.store';
import { PkKpiComponent } from '../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { PkCardComponent } from '../../theme/ProautoKimium/pk-card/pk-card.component';
import { PkSegmentedComponent } from '../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkEmptyComponent } from '../../theme/ProautoKimium/pk-empty/pk-empty.component';

/** Doze meses para trás: a newsletter é mensal e o cliente compara com o ano. */
const MONTHS_BACK = 12;

/**
 * Dashboard do cliente — a newsletter em forma de painel.
 *
 * Busca a série inteira de uma vez e escolhe o mês no cliente: são doze linhas
 * por unidade, e ir ao servidor a cada troca de mês seria mais lento do que
 * trazer tudo.
 *
 * Quando a matriz olha várias unidades, os números do mês são somados — menos
 * o produto em destaque, que não se soma e vira o mais frequente.
 */
@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, PkKpiComponent, PkCardComponent, PkSegmentedComponent, PkEmptyComponent],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.scss',
})
export class ClientDashboardComponent {

  private readonly service = inject(ClientService);
  readonly session = inject(ClientSessionStore);

  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly rows = signal<ClientNewsletter[]>([]);

  /** Mês escolhido, no formato `yyyy-MM`. Vazio antes da primeira carga. */
  readonly month = signal('');

  constructor() {
    // Recarrega quando a unidade muda no cabeçalho. O `me()` entra na conta
    // porque a primeira carga só pode acontecer depois da sessão existir.
    effect(() => {
      const me = this.session.me();
      const units = this.session.selectedUnits();
      if (me) this.load(units);
    });
  }

  private load(units: string[]): void {
    this.loading.set(true);
    this.failed.set(false);

    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - MONTHS_BACK + 1, 1);

    this.service.newsletter(dayKey(from), dayKey(to), units).subscribe({
      next: rows => {
        this.rows.set(rows ?? []);
        this.loading.set(false);

        // Sem mês escolhido, ou com um mês que sumiu ao trocar de unidade,
        // cai no mais recente que existe.
        const months = this.months();
        if (months.length && !months.some(option => option.value === this.month())) {
          this.month.set(months[months.length - 1].value);
        }
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** Meses com dado, do mais antigo para o mais novo. */
  readonly months = computed(() => {
    const keys = [...new Set(this.rows().map(row => (row.data ?? '').slice(0, 7)).filter(Boolean))].sort();

    return keys.map(key => ({
      value: key,
      label: `${MONTH_SHORT[Number(key.slice(5, 7)) - 1]}`,
    }));
  });

  /** As linhas do mês escolhido — uma por unidade. */
  readonly current = computed(() =>
    this.rows().filter(row => (row.data ?? '').startsWith(this.month())));

  readonly hasData = computed(() => this.current().length > 0);

  // ─── Números do mês ───────────────────────────────────────────────────────

  readonly faturamento = computed(() => this.sum(row => row.faturamentoTotal));
  readonly litros = computed(() => this.sum(row => row.quantidadeLitros));
  readonly produtos = computed(() => this.sum(row => row.quantidadeProdutos));
  readonly notas = computed(() => this.sum(row => row.quantidadeNotasEmitidas));
  readonly visitas = computed(() => this.sum(row => row.quantidadeDeVisitas));
  readonly pecas = computed(() => this.sum(row => row.valorPecasTrocadas));
  readonly horas = computed(() => this.sum(row => row.valorTotalDeHoras) + this.sum(row => row.valorTotalDeHorasMauUso));
  readonly horasCobradas = computed(() =>
    this.sum(row => row.valorTotalCobradoHoras) + this.sum(row => row.valorTotalCobradoHorasMauUso));

  readonly horasMauUso = computed(() => this.sum(row => row.valorTotalDeHorasMauUso));
  readonly valorMauUso = computed(() => this.sum(row => row.valorTotalCobradoHorasMauUso));
  readonly temMauUso = computed(() => this.current().some(row => row.mauUso));

  /** Média ponderada não faz sentido aqui: é a média dos dias de atendimento. */
  readonly mediaDias = computed(() => {
    const rows = this.current().filter(row => row.mediaDiasAtendimento > 0);
    if (!rows.length) return 0;
    return Math.round(rows.reduce((total, row) => total + row.mediaDiasAtendimento, 0) / rows.length);
  });

  /** Produto em destaque não se soma: com várias unidades, vale o mais citado. */
  readonly produtoDestaque = computed(() => {
    const counts = new Map<string, number>();

    for (const row of this.current()) {
      const name = (row.produtoDestaque ?? '').trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  });

  readonly monthLabel = computed(() => {
    const key = this.month();
    if (!key) return '';
    return `${MONTH_FULL[Number(key.slice(5, 7)) - 1]} de ${key.slice(0, 4)}`;
  });

  setMonth(value: string): void {
    this.month.set(value);
  }

  money(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  }

  decimal(value: number, digits = 0): string {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value || 0);
  }

  private sum(pick: (row: ClientNewsletter) => number): number {
    return this.current().reduce((total, row) => total + (pick(row) || 0), 0);
  }
}

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Chave local `2026-08-13`. `toISOString` viraria o dia em fuso negativo. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
