import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';

import { InventoryMovement, InventoryProductResponse } from '../../../../domain/models/products.model';
import {
  IN_STOCK_STATUSES,
  MACHINE_STATUS_LABEL,
  ReconcileRequest,
} from '../../../../domain/models/prostock/machine.model';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { InventoryProductStore } from '../../../../infrastructure/state/inventory-product.store';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { downloadFileResponse } from '../../../../infrastructure/services/tools/pdf-tools.service';
import { formatDateOnly } from '../../../../domain/utils/date-only';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';

type MovementKind = 'in' | 'out';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, DatePickerModule, InputTextModule, Toast,
    ToolbarComponent, PkButtonComponent, PkTableComponent, PkDialogComponent,
  ],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
  providers: [MessageService],
})
export class MovementsComponent implements OnInit {

  private readonly productStore = inject(InventoryProductStore);
  private readonly service = inject(InventoryProductService);
  private readonly messageService = inject(MessageService);
  private readonly machineService = inject(MachineService);
  private readonly registerService = inject(RegisterService);

  readonly loadingProducts = this.productStore.loading;

  // ─── Lista de produtos (master) ───────────────────────────────────────────
  search = '';
  private readonly searchTrigger = signal(0);
  private readonly lowStockCodes = signal<ReadonlySet<string>>(new Set<string>());

  readonly filteredProducts = computed(() => {
    this.searchTrigger();
    const term = this.search.toLowerCase().trim();
    const list = this.productStore.items();
    if (!term) return list;

    return list.filter(p =>
      p.name.toLowerCase().includes(term) || p.systemCode.toLowerCase().includes(term));
  });

  // ─── Produto selecionado (detail) ─────────────────────────────────────────
  readonly selected = signal<InventoryProductResponse | null>(null);
  readonly movements = signal<InventoryMovement[]>([]);
  readonly loadingDetail = signal(false);

  /**
   * Estoque atual é a quantidade do ÚLTIMO movimento — a base guarda o valor
   * absoluto resultante, não a diferença.
   *
   * "Último" é o último **registrado**, não o último datado: `movementDate` é
   * `date` no banco e não tem hora, então dois lançamentos do mesmo dia
   * empatavam e o último da lista saía por acaso.
   */
  readonly currentStock = computed(() => {
    const list = this.sortedMovements();
    return list.length ? list[list.length - 1].quantity : 0;
  });

  readonly lastChange = computed(() => {
    const list = this.sortedMovements();
    return list.length ? list[list.length - 1].movementDate : null;
  });

  /**
   * A API já devolve ordenado por `createdAt`. Reordenar aqui é cinto de
   * segurança para o dia em que alguém mexer lá — e o `??` cobre movimentação
   * antiga vinda de cliente que não manda o campo.
   */
  readonly sortedMovements = computed(() =>
    [...this.movements()].sort((a, b) =>
      (a.createdAt ?? a.movementDate).localeCompare(b.createdAt ?? b.movementDate)));

  /** Histórico mostrado: mais recente primeiro, com filtro opcional de período. */
  readonly historyRows = computed(() => {
    const rows = [...this.sortedMovements()].reverse();
    const from = this.periodFrom();
    const to = this.periodTo();
    if (!from && !to) return rows;

    return rows.filter(row => {
      const date = row.movementDate.slice(0, 10);
      if (from && date < formatDateOnly(from)!) return false;
      if (to && date > formatDateOnly(to)!) return false;
      return true;
    });
  });

  // ─── Lançamento ───────────────────────────────────────────────────────────
  // `kind` e `quantity` são signals porque a prévia é um `computed` em cima
  // deles: como campo simples, clicar em Entrada/Saída não recalcularia nada —
  // signal só reage a signal.
  readonly kind = signal<MovementKind>('in');
  readonly quantity = signal(1);
  movementDate: Date = new Date();
  saving = false;

  /** Prévia ao vivo, como no desktop: atual → movimento → novo. */
  readonly newStock = computed(() => {
    const delta = this.kind() === 'in' ? this.quantity() : -this.quantity();
    return this.currentStock() + delta;
  });

  readonly wouldGoNegative = computed(() => this.newStock() < 0);

  // ─── Período e relatório ──────────────────────────────────────────────────
  readonly periodFrom = signal<Date | null>(null);
  readonly periodTo = signal<Date | null>(null);
  reportDate: Date = new Date();
  generatingReport = false;

  ngOnInit(): void {
    this.productStore.load();
    this.loadLowStock();
  }

  refresh(): void {
    this.productStore.refresh();
    this.loadLowStock();

    const product = this.selected();
    if (product) this.loadMovements(product.systemCode);
  }

  private loadLowStock(): void {
    this.productStore.lowStock().subscribe({
      next: (list) => this.lowStockCodes.set(new Set(list.map(p => p.systemCode))),
      error: () => this.lowStockCodes.set(new Set()),
    });
  }

  onSearch(): void {
    this.searchTrigger.update(v => v + 1);
  }

  isLow(product: InventoryProductResponse): boolean {
    return this.lowStockCodes().has(product.systemCode);
  }

  select(product: InventoryProductResponse): void {
    this.selected.set(product);
    this.resetEntry();
    this.loadMovements(product.systemCode);
  }

  private loadMovements(systemCode: string): void {
    this.loadingDetail.set(true);
    this.service.getInventoryMovementsByProduct(systemCode).subscribe({
      next: (list) => {
        this.movements.set(list ?? []);
        this.loadingDetail.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.movements.set([]);
        this.loadingDetail.set(false);
        // 404 aqui é produto sem movimento nenhum, não erro de verdade.
        if (err.status !== 404) this.showError(err);
      },
    });
  }

  setKind(kind: MovementKind): void {
    this.kind.set(kind);
  }

  onQuantityChange(value: number | string): void {
    const parsed = Number(value);
    this.quantity.set(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0);
  }

  readonly canSubmit = computed(() =>
    !!this.selected() && this.quantity() > 0 && !this.wouldGoNegative());

  submit(): void {
    const product = this.selected();
    if (!product || !this.canSubmit() || this.saving) return;

    // Máquina não grava direto: uma linha de programação É uma máquina física,
    // então mexer no estoque sem mexer na programação separa os dois números em
    // silêncio. A conciliação pergunta antes; produto comum segue igual.
    if (product.isMachine) {
      this.openReconciliation(product);
      return;
    }

    this.saving = true;

    // `quantity` é o estoque resultante: é assim que o desktop grava, e os dois
    // escrevem na mesma base.
    const movement: InventoryMovement = {
      systemCode: product.systemCode,
      quantity: this.newStock(),
      movementDate: this.toLocalDateTime(this.movementDate),
    };

    this.service.addInventoryMovement(movement).subscribe({
      next: () => {
        this.saving = false;
        this.resetEntry();
        this.loadMovements(product.systemCode);
        this.messageService.add({
          severity: 'success',
          summary: 'Movimentação registrada',
          detail: `Novo estoque de ${product.name}: ${movement.quantity}.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.showError(err);
      },
    });
  }

  // ─── Conciliação com a programação (só máquina) ───────────────────────────
  // Entrada cria programações; saída entrega as que a pessoa escolher. A tela
  // LISTA e CONFIRMA, nunca decide: qual máquina foi para qual cliente é
  // informação que só quem lançou tem.

  /** Máquina é produto marcado, não tipo à parte — por isso é uma flag. */
  readonly isMachine = computed(() => !!this.selected()?.isMachine);

  readonly reconciliationOpen = signal(false);
  readonly candidates = signal<MachineRegister[]>([]);
  readonly loadingCandidates = signal(false);
  readonly chosenIds = signal<ReadonlySet<string>>(new Set<string>());

  /** Quantas máquinas o lançamento move — sempre positivo, para o texto. */
  readonly reconciliationCount = computed(() => this.quantity());

  /**
   * A conta só fecha com o número exato.
   *
   * Escolher menos e confirmar é justamente o erro que a conciliação existe
   * para impedir: o estoque cairia 3 e a programação perderia 2. A API recusa
   * de novo — aqui é só para o botão não mentir que dá.
   */
  readonly canConfirmReconciliation = computed(() =>
    this.kind() === 'in' || this.chosenIds().size === this.quantity());

  /** Saída de 3 com 2 máquinas programadas: não tem como fechar. */
  readonly notEnoughCandidates = computed(() =>
    this.kind() === 'out'
    && !this.loadingCandidates()
    && this.candidates().length < this.quantity());

  private openReconciliation(product: InventoryProductResponse): void {
    this.chosenIds.set(new Set<string>());
    this.candidates.set([]);
    this.reconciliationOpen.set(true);

    if (this.kind() === 'out') this.loadCandidates(product);
  }

  /**
   * As candidatas são as que estão no galpão — e só as daquela máquina.
   *
   * ENTREGUE fica de fora porque já saiu, e entregar de novo faria o movimento
   * baixar estoque sem nada ter saído.
   */
  private loadCandidates(product: InventoryProductResponse): void {
    this.loadingCandidates.set(true);
    this.registerService.getByMachine(product.id).subscribe({
      next: (list) => {
        this.candidates.set((list ?? []).filter(r => IN_STOCK_STATUSES.includes(r.status)));
        this.loadingCandidates.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.candidates.set([]);
        this.loadingCandidates.set(false);
        if (err.status !== 404) this.showError(err);
      },
    });
  }

  toggleCandidate(id: string): void {
    // Set novo a cada clique: mutar o mesmo objeto não trocaria a referência, e
    // o signal não avisaria ninguém.
    const next = new Set(this.chosenIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.chosenIds.set(next);
  }

  isChosen(id: string): boolean {
    return this.chosenIds().has(id);
  }

  closeReconciliation(): void {
    this.reconciliationOpen.set(false);
    this.chosenIds.set(new Set<string>());
    this.candidates.set([]);
  }

  confirmReconciliation(): void {
    const product = this.selected();
    if (!product || !this.canConfirmReconciliation() || this.saving) return;

    const incoming = this.kind() === 'in';
    this.saving = true;

    const request: ReconcileRequest = {
      systemCode: product.systemCode,
      // Delta, não estoque resultante: é o que deixa o servidor conferir que os
      // dois lados contam o mesmo número — e ele lê o estoque atual do banco em
      // vez de aceitar o que esta tela tinha em cache.
      delta: incoming ? this.quantity() : -this.quantity(),
      movementDate: this.toLocalDateTime(this.movementDate),
      registersToDeliver: incoming ? [] : [...this.chosenIds()],
      registersToCreate: incoming ? this.quantity() : 0,
    };

    this.machineService.reconcile(request).subscribe({
      next: () => {
        this.saving = false;
        this.closeReconciliation();
        this.resetEntry();
        this.loadMovements(product.systemCode);
        this.messageService.add({
          severity: 'success',
          summary: 'Estoque e programação atualizados',
          detail: incoming
            ? `${request.registersToCreate} programação(ões) criada(s) sem previsão.`
            : `${request.registersToDeliver.length} programação(ões) marcada(s) como entregue.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        // Fica aberto de propósito: 400 aqui é a conta não fechando, e fechar o
        // diálogo faria a pessoa refazer a escolha inteira para ler o motivo.
        this.showError(err);
      },
    });
  }

  statusLabel(register: MachineRegister): string {
    return MACHINE_STATUS_LABEL[register.status] ?? register.status;
  }

  private resetEntry(): void {
    this.kind.set('in');
    this.quantity.set(1);
    this.movementDate = new Date();
  }

  clearPeriod(): void {
    this.periodFrom.set(null);
    this.periodTo.set(null);
  }

  generateReport(): void {
    const date = formatDateOnly(this.reportDate);
    if (!date) return;

    this.generatingReport = true;
    this.service.getMovementsReport(date).subscribe({
      next: (response) => {
        this.generatingReport = false;
        if (!downloadFileResponse(response, `estoque-${date}.xlsx`)) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Sem dados',
            detail: 'Não há movimentações para essa data.',
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.generatingReport = false;
        this.messageService.add({
          severity: 'warn',
          summary: 'Relatório não gerado',
          detail: err.status === 404 ? 'Não há movimentações para essa data.' : this.errorMessage(err),
        });
      },
    });
  }

  formatDateTime(iso: string): string {
    // `movementDate` é LocalDateTime, então `new Date` já lê como hora local.
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /** A API espera LocalDateTime sem fuso; enviar ISO com Z deslocaria o dia. */
  private toLocalDateTime(date: Date): string {
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private showError(err: HttpErrorResponse): void {
    this.messageService.add({ severity: 'error', summary: 'Erro', detail: this.errorMessage(err) });
  }

  private errorMessage(err: HttpErrorResponse): string {
    switch (err.status) {
      case 0:   return 'Sem conexão com o servidor.';
      case 400: return 'Dados inválidos.';
      case 403: return 'Você não tem permissão para esta ação.';
      case 404: return 'Produto ou movimentação não encontrada.';
      default:  return typeof err.error === 'string' ? err.error : 'Erro inesperado.';
    }
  }
}
