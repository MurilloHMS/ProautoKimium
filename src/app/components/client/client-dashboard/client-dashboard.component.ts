import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ClientNewsletter } from '../../../domain/models/client.model';
import { ClientService } from '../../../infrastructure/services/client/client.service';
import { ClientSessionStore } from '../../../infrastructure/state/client-session.store';
import { PkEmptyComponent } from '../../theme/ProautoKimium/pk-empty/pk-empty.component';
import { PkBarComponent } from '../../theme/ProautoKimium/pk-bar/pk-bar.component';
import { Tooltip } from 'primeng/tooltip';

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
  imports: [CommonModule, Tooltip, PkEmptyComponent, PkBarComponent],
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

  /**
   * O faturamento do desenho é um número só em três tamanhos: "R$" pequeno,
   * inteiro grande, centavos pequenos. Separar aqui evita `slice` no template.
   */
  readonly faturamentoParts = computed(() => {
    const parts = this.decimal(this.faturamento(), 2).split(',');
    return { inteiro: parts[0], centavos: parts[1] ?? '00' };
  });

  /** E-mail e status vêm da própria linha do informativo. */
  readonly emailCliente = computed(() => this.current()[0]?.email ?? '');
  readonly enviado = computed(() => this.current().some(row => row.status === 'SENT'));

  /** `JUNHO 2026 · CLEANING BRASIL` — a sobrancelha do hero. */
  readonly eyebrow = computed(() => {
    const mes = this.monthLabel().replace(' de ', ' ');
    return `${mes} · ${this.session.scopeLabel()}`.toUpperCase();
  });

  /**
   * A manchete do desenho muda de tom conforme o mês: com mau uso, ela chama
   * para a conversa; sem, celebra o número. O designer escreveu a primeira.
   */
  readonly headline = computed(() => this.temMauUso()
    ? { first: 'Sua operação merece', second: 'uma conversa.' }
    : { first: 'Sua operação', second: 'em números.' });

  /** O parágrafo do hero, montado com os números do mês. */
  readonly summary = computed(() => {
    const partes = [
      `Em ${this.monthLabel().split(' de ')[0]} você consumiu ${this.decimal(this.litros())} litros`,
      `e emitiu ${this.notas()} nota(s)`,
    ];

    if (this.mediaDias() > 0) partes.push(`— atendimento médio em ${this.mediaDias()} dias úteis`);

    const texto = `${partes.join(' ')}.`;

    return this.temMauUso()
      ? `${texto} Identificamos horas técnicas por mau uso que precisam da sua atenção.`
      : texto;
  });

  private readonly monthIndex = computed(() =>
    this.months().findIndex(option => option.value === this.month()));

  readonly canPrev = computed(() => this.monthIndex() > 0);
  readonly canNext = computed(() => {
    const index = this.monthIndex();
    return index >= 0 && index < this.months().length - 1;
  });

  // ─── Série e comparações ──────────────────────────────────────────────────

  /**
   * Faturamento e litros de cada mês da série.
   *
   * Os doze meses já vêm na primeira carga — o gráfico não custa requisição
   * nenhuma, só a soma das linhas de cada mês.
   */
  readonly serie = computed(() => {
    const porMes = new Map<string, { faturamento: number; litros: number }>();

    for (const row of this.rows()) {
      const key = (row.data ?? '').slice(0, 7);
      if (!key) continue;

      const bucket = porMes.get(key) ?? { faturamento: 0, litros: 0 };
      bucket.faturamento += row.faturamentoTotal || 0;
      bucket.litros += row.quantidadeLitros || 0;
      porMes.set(key, bucket);
    }

    const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
    const maior = Math.max(1, ...meses.map(([, bucket]) => bucket.faturamento));

    return meses.map(([key, bucket]) => ({
      key,
      label: MONTH_SHORT[Number(key.slice(5, 7)) - 1],
      faturamento: bucket.faturamento,
      litros: bucket.litros,
      percent: Math.round((bucket.faturamento / maior) * 100),
    }));
  });

  /** O mês anterior ao escolhido, quando ele existe na série. */
  private readonly anterior = computed(() => {
    const index = this.monthIndex();
    return index > 0 ? this.serie()[index - 1] : null;
  });

  /** Variação percentual contra o mês anterior; `null` quando não há base. */
  private variacao(atual: number, base: number | undefined): number | null {
    if (base === undefined || base <= 0) return null;
    return Math.round(((atual - base) / base) * 100);
  }

  readonly varFaturamento = computed(() => this.variacao(this.faturamento(), this.anterior()?.faturamento));
  readonly varLitros = computed(() => this.variacao(this.litros(), this.anterior()?.litros));

  /** Quanto vale cada nota emitida no mês. */
  readonly ticketMedio = computed(() => {
    const notas = this.notas();
    return notas > 0 ? this.faturamento() / notas : 0;
  });

  /** Quanto custou o litro no mês — o número que o comprador compara. */
  readonly precoLitro = computed(() => {
    const litros = this.litros();
    return litros > 0 ? this.faturamento() / litros : 0;
  });

  /** Fatia das horas técnicas que foi cobrada como mau uso. */
  readonly percentMauUso = computed(() => {
    const horas = this.horas();
    return horas > 0 ? Math.round((this.horasMauUso() / horas) * 100) : 0;
  });

  /** Participação de cada unidade no faturamento do mês — para as barras. */
  readonly porUnidade = computed(() => {
    const total = this.faturamento() || 1;

    return [...this.current()]
      .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal)
      .map(row => ({
        row,
        percent: Math.round((row.faturamentoTotal / total) * 100),
      }));
  });

  sinal(valor: number | null): string {
    if (valor === null) return '';
    return valor > 0 ? `+${valor}%` : `${valor}%`;
  }

  /**
   * Valor curto para caber em cima da coluna: `R$ 17,0 mil`, `R$ 3,7 mi`.
   *
   * O valor cheio continua no tooltip — aqui o que importa é comparar alturas,
   * e `R$ 17.000,92` em cima de uma barra de 54px não cabe nem ajuda.
   */
  compacto(valor: number): string {
    if (valor >= 1_000_000) return `R$ ${this.decimal(valor / 1_000_000, 1)} mi`;
    if (valor >= 1_000) return `R$ ${this.decimal(valor / 1_000, 1)} mil`;
    return this.money(valor);
  }

  /** O ano só entra no rótulo quando a série cruza a virada. */
  readonly serieCruzaAno = computed(() =>
    new Set(this.serie().map(mes => mes.key.slice(0, 4))).size > 1);

  setMonth(value: string): void {
    this.month.set(value);
  }

  step(direction: -1 | 1): void {
    const months = this.months();
    const next = this.monthIndex() + direction;
    if (next >= 0 && next < months.length) this.month.set(months[next].value);
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
