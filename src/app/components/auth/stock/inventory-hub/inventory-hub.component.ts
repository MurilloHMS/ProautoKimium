import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Tooltip } from 'primeng/tooltip';
import { catchError, from, mergeMap, of, tap, toArray } from 'rxjs';

import { InventoryMovement, InventoryProductResponse } from '../../../../domain/models/products.model';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkBarComponent, PkBarTone } from '../../../theme/ProautoKimium/pk-bar/pk-bar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCardComponent } from '../../../theme/ProautoKimium/pk-card/pk-card.component';
import { PkEmptyComponent } from '../../../theme/ProautoKimium/pk-empty/pk-empty.component';
import { PkKpiComponent } from '../../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';

/** Requisições simultâneas ao buscar o histórico produto a produto. */
const CONCURRENCY = 6;

/** Sem movimento há tanto tempo que provavelmente ninguém usa mais. */
const IDLE_DAYS = 90;

interface ProductSummary {
  product: InventoryProductResponse;
  stock: number;
  lastMovement: string | null;
  /** Entradas e saídas dentro do período escolhido. */
  in: number;
  out: number;
  /** Dias desde o último movimento; `null` quando o produto nunca movimentou. */
  idleDays: number | null;
}

interface DayFlow {
  key: string;
  label: string;
  in: number;
  out: number;
  inPercent: number;
  outPercent: number;
}

interface FeedItem {
  product: string;
  date: string;
  delta: number;
  stock: number;
}

/**
 * Hub do Estoque.
 *
 * A API só serve movimentação **por produto** (`GET api/inventory/movements/
 * {systemCode}`) — não existe endpoint que liste tudo. Então o hub busca o
 * histórico de cada produto, com {@link CONCURRENCY} requisições ao mesmo
 * tempo, e mostra o progresso: com duzentos produtos isso demora, e uma tela
 * parada sem explicação parece travada.
 *
 * A conta que dá sentido a tudo: a base guarda o **estoque resultante**, não a
 * diferença. Entrada e saída não existem como dado — saem da variação entre um
 * movimento e o anterior. É o número que nem o desktop mostrava.
 */
@Component({
  selector: 'app-inventory-hub',
  standalone: true,
  imports: [
    CommonModule, RouterLink, Tooltip, PageHeaderComponent,
    PkBarComponent, PkButtonComponent, PkCardComponent, PkEmptyComponent,
    PkKpiComponent, PkSegmentedComponent,
  ],
  templateUrl: './inventory-hub.component.html',
  styleUrl: './inventory-hub.component.scss',
})
export class InventoryHubComponent implements OnInit {

  private readonly service = inject(InventoryProductService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly loaded = signal(0);
  readonly total = signal(0);
  readonly failed = signal(false);

  /**
   * Produtos cujo histórico a API recusou. Ficam de fora das contas: entrar
   * como estoque zero seria pior que faltar, porque o número mentiria.
   */
  readonly brokenCodes = signal<string[]>([]);

  readonly products = signal<InventoryProductResponse[]>([]);
  private readonly histories = signal<Map<string, InventoryMovement[]>>(new Map());

  /** Janela dos indicadores de fluxo. O estoque atual não depende dela. */
  readonly periodDays = signal(30);
  readonly periodSegments = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
  ];

  readonly progress = computed(() => {
    const total = this.total();
    return total ? Math.round((this.loaded() / total) * 100) : 0;
  });

  /**
   * Uma linha por produto, já com estoque atual e o movimentado no período.
   *
   * O delta é a variação para o movimento anterior; o primeiro movimento da
   * vida do produto conta como entrada, que é o que ele significa.
   */
  private readonly summaries = computed<ProductSummary[]>(() => {
    const histories = this.histories();
    const from = this.periodStart();
    const today = startOfToday();
    const broken = new Set(this.brokenCodes());

    return this.products().filter(product => !broken.has(product.systemCode)).map(product => {
      const history = [...(histories.get(product.systemCode) ?? [])]
        .sort((a, b) => a.movementDate.localeCompare(b.movementDate));

      let entered = 0;
      let left = 0;

      history.forEach((movement, index) => {
        const delta = index === 0
          ? movement.quantity
          : movement.quantity - history[index - 1].quantity;

        if (movement.movementDate.slice(0, 10) < from) return;
        if (delta > 0) entered += delta;
        else left += -delta;
      });

      const last = history.length ? history[history.length - 1] : null;

      return {
        product,
        stock: last ? last.quantity : 0,
        lastMovement: last ? last.movementDate : null,
        in: entered,
        out: left,
        idleDays: last ? daysBetween(last.movementDate, today) : null,
      };
    });
  });

  private periodStart(): string {
    const start = startOfToday();
    start.setDate(start.getDate() - this.periodDays() + 1);
    return dayKey(start);
  }

  // ─── Indicadores ──────────────────────────────────────────────────────────

  readonly activeCount = computed(() => this.products().filter(item => item.active).length);
  readonly totalItems = computed(() => this.summaries().reduce((sum, item) => sum + item.stock, 0));

  readonly belowMinimum = computed(() =>
    this.summaries().filter(item => item.product.minimumStock > 0 && item.stock < item.product.minimumStock));

  readonly outOfStock = computed(() => this.summaries().filter(item => item.stock === 0));

  readonly totalIn = computed(() => this.summaries().reduce((sum, item) => sum + item.in, 0));
  readonly totalOut = computed(() => this.summaries().reduce((sum, item) => sum + item.out, 0));

  /** Saldo do período: positivo é estoque crescendo, negativo é consumo. */
  readonly balance = computed(() => this.totalIn() - this.totalOut());

  /**
   * Estoque parado. Nunca ter movimentado é diferente de estar parado há muito
   * tempo, então produto sem histórico fica de fora — ele é cadastro, não sobra.
   */
  readonly idle = computed(() =>
    this.summaries()
      .filter(item => item.idleDays !== null && item.idleDays >= IDLE_DAYS && item.stock > 0)
      .sort((a, b) => (b.idleDays ?? 0) - (a.idleDays ?? 0))
      .slice(0, 8));

  /** Situação do estoque, para a barra de distribuição. */
  readonly healthSlices = computed<{ label: string; count: number; percent: number; tone: PkBarTone }[]>(() => {
    const total = this.summaries().length || 1;
    const zero = this.outOfStock().length;
    const below = this.belowMinimum().filter(item => item.stock > 0).length;
    const ok = this.summaries().length - zero - below;

    // Tipado antes do filter: o `.filter` corta a inferência contextual e o
    // literal 'success' voltaria a ser um string qualquer.
    const slices: { label: string; count: number; percent: number; tone: PkBarTone }[] = [
      { label: 'Dentro do mínimo', count: ok, percent: Math.round((ok / total) * 100), tone: 'success' },
      { label: 'Abaixo do mínimo', count: below, percent: Math.round((below / total) * 100), tone: 'warning' },
      { label: 'Sem estoque', count: zero, percent: Math.round((zero / total) * 100), tone: 'danger' },
    ];

    return slices.filter(slice => slice.count > 0);
  });

  /** Os oito que mais giraram no período — entradas e saídas somadas. */
  readonly topMoved = computed(() => {
    const rows = this.summaries()
      .map(item => ({ ...item, moved: item.in + item.out }))
      .filter(item => item.moved > 0)
      .sort((a, b) => b.moved - a.moved)
      .slice(0, 8);

    const max = rows.length ? rows[0].moved : 1;
    return rows.map(row => ({ ...row, percent: Math.round((row.moved / max) * 100) }));
  });

  /** Entradas e saídas por dia, no período. Barras em CSS, sem biblioteca. */
  readonly dailyFlow = computed<DayFlow[]>(() => {
    const histories = this.histories();
    const from = this.periodStart();
    const byDay = new Map<string, { in: number; out: number }>();

    for (const history of histories.values()) {
      const sorted = [...history].sort((a, b) => a.movementDate.localeCompare(b.movementDate));

      sorted.forEach((movement, index) => {
        const day = movement.movementDate.slice(0, 10);
        if (day < from) return;

        const delta = index === 0 ? movement.quantity : movement.quantity - sorted[index - 1].quantity;
        const bucket = byDay.get(day) ?? { in: 0, out: 0 };
        if (delta > 0) bucket.in += delta;
        else bucket.out += -delta;
        byDay.set(day, bucket);
      });
    }

    // Dias sem movimento entram zerados: o buraco no gráfico é informação.
    const days: DayFlow[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const today = startOfToday();

    while (cursor <= today) {
      const key = dayKey(cursor);
      const bucket = byDay.get(key) ?? { in: 0, out: 0 };
      days.push({
        key,
        label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
        in: bucket.in,
        out: bucket.out,
        inPercent: 0,
        outPercent: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const max = Math.max(1, ...days.map(day => Math.max(day.in, day.out)));
    return days.map(day => ({
      ...day,
      inPercent: Math.round((day.in / max) * 100),
      outPercent: Math.round((day.out / max) * 100),
    }));
  });

  /** As doze movimentações mais recentes, de todos os produtos. */
  readonly feed = computed<FeedItem[]>(() => {
    const names = new Map(this.products().map(product => [product.systemCode, product.name]));
    const items: FeedItem[] = [];

    for (const [systemCode, history] of this.histories()) {
      const sorted = [...history].sort((a, b) => a.movementDate.localeCompare(b.movementDate));

      sorted.forEach((movement, index) => {
        items.push({
          product: names.get(systemCode) ?? systemCode,
          date: movement.movementDate,
          delta: index === 0 ? movement.quantity : movement.quantity - sorted[index - 1].quantity,
          stock: movement.quantity,
        });
      });
    }

    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  });

  // ─── Carga ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.loaded.set(0);

    this.service.getInventoryProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: products => {
          this.products.set(products);
          this.total.set(products.length);

          // Catálogo vazio não é erro: os cartões dizem isso sozinhos.
          if (products.length === 0) {
            this.loading.set(false);
            return;
          }

          this.loadHistories(products);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  /**
   * Um GET por produto, seis de cada vez. Em paralelo total, duzentas
   * requisições derrubariam a API; em série, a tela levaria minutos.
   */
  private loadHistories(products: InventoryProductResponse[]): void {
    const histories = new Map<string, InventoryMovement[]>();
    const broken: string[] = [];

    from(products)
      .pipe(
        mergeMap(product => this.service.getInventoryMovementsByProduct(product.systemCode).pipe(
          // Produto que falha entraria como estoque zero, o que é mentira.
          // Fica de fora da conta e vai para o aviso.
          catchError(() => {
            broken.push(product.systemCode);
            return of(null);
          }),
          tap(list => {
            if (list) histories.set(product.systemCode, list);
            this.loaded.update(value => value + 1);
          }),
        ), CONCURRENCY),
        toArray(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.histories.set(histories);
        this.brokenCodes.set(broken);
        this.loading.set(false);
      });
  }

  setPeriod(days: number): void {
    this.periodDays.set(days);
  }

  idleLabel(days: number | null): string {
    if (days === null) return 'nunca movimentou';
    if (days >= 365) return `há mais de um ano`;
    return `há ${days} dias`;
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Chave local `2026-08-11`. `toISOString` viraria o dia em fuso negativo. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Dias inteiros entre um `LocalDateTime` da API e hoje. */
function daysBetween(iso: string, today: Date): number {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Math.max(0, Math.round((today.getTime() - date.getTime()) / 86_400_000));
}
