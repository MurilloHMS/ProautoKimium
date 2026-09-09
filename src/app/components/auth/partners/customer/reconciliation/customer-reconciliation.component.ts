import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { PkEmptyComponent } from '../../../../theme/ProautoKimium/pk-empty/pk-empty.component';
import { PkSegmentedComponent, type PkSegmentedOption } from '../../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { CustomerReconciliationService } from '../../../../../infrastructure/services/partners/customer/customer-reconciliation.service';
import {
  FIELD_LABEL,
  canApply,
  isGroupChange,
  type Reconciliation,
  type ReconciliationRow,
} from '../../../../../domain/models/customer-reconciliation.model';

type Bucket = 'toCreate' | 'toUpdate' | 'toDeactivate';

/** O que a tela mostra num dado momento. */
export type ReconciliationState = 'empty' | 'loading' | 'reviewing' | 'applying' | 'error';

/**
 * Conciliação do cadastro de clientes com o Sankhya.
 *
 * O ERP e o KimiumHub são a mesma lista mantida duas vezes. Antes disto, o único
 * caminho em lote era uma planilha — sem prévia, sem conciliação, e um e-mail
 * ruim derrubava o arquivo inteiro com um erro que não dizia qual linha.
 *
 * **Nada é gravado sem marcação.** A prévia só lê, e pode ser refeita à vontade.
 */
@Component({
  selector: 'app-customer-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule, PkEmptyComponent, PkSegmentedComponent],
  templateUrl: './customer-reconciliation.component.html',
  styleUrl: './customer-reconciliation.component.scss',
})
export class CustomerReconciliationComponent {

  private readonly service = inject(CustomerReconciliationService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Avisa o pai para recarregar a grade: os dados dele mudaram. */
  readonly applied = output<void>();
  readonly closed = output<void>();

  readonly months = signal(12);
  readonly options = [12, 24, 36];

  /**
   * Uma seção por vez.
   *
   * Três baldes empilhados viram uma página longa de linhas com alturas
   * diferentes — e "impedidos" é justamente a lista que alguém abre para ir
   * consertar no ERP, atravessada nas outras.
   *
   * `pk-segmented` e não abas do PrimeNG: isto é estado de tela, e o tema já
   * tem o componente.
   */
  readonly filter = signal<'all' | 'toCreate' | 'toUpdate' | 'toDeactivate' | 'blocked'>('all');

  readonly state = signal<ReconciliationState>('empty');
  readonly data = signal<Reconciliation | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly search = signal('');

  /** Os códigos marcados. Nada fora daqui é enviado. */
  readonly selected = signal<Set<string>>(new Set());

  readonly fieldLabel = FIELD_LABEL;
  readonly canApply = canApply;
  readonly isGroupChange = isGroupChange;

  /**
   * Tabela no computador, cartões no celular.
   *
   * `@if` e não `display: none`: cada linha tem caixa de seleção, e escondida
   * por CSS ela continua viva no DOM — foco, tab e leitor de tela passariam por
   * um formulário invisível.
   */
  readonly isPhone = signal(false);

  constructor() {
    const phone = window.matchMedia('(max-width: 768px)');
    const apply = () => this.isPhone.set(phone.matches);

    phone.addEventListener('change', apply);
    this.destroyRef.onDestroy(() => phone.removeEventListener('change', apply));
    apply();
  }

  // ── As listas ─────────────────────────────────────────────────────────────

  readonly toCreate = computed(() => this.inFilter('toCreate', this.data()?.toCreate ?? []));
  readonly toUpdate = computed(() => this.inFilter('toUpdate', this.data()?.toUpdate ?? []));
  readonly toDeactivate = computed(() => this.inFilter('toDeactivate', this.data()?.toDeactivate ?? []));

  /** Os impedidos dos três baldes juntos — é a lista de "vai consertar no ERP". */
  readonly blocked = computed(() =>
    this.visible(this.allRows().filter(row => !canApply(row))));

  readonly filters = computed<PkSegmentedOption[]>(() => {
    const data = this.data();
    const impeded = this.allRows().filter(row => !canApply(row)).length;

    return [
      { label: `Tudo (${(data?.toCreate.length ?? 0) + (data?.toUpdate.length ?? 0) + (data?.toDeactivate.length ?? 0)})`, value: 'all' },
      { label: `Novos (${data?.toCreate.length ?? 0})`, value: 'toCreate' },
      { label: `Com diferença (${data?.toUpdate.length ?? 0})`, value: 'toUpdate' },
      { label: `Inativos no ERP (${data?.toDeactivate.length ?? 0})`, value: 'toDeactivate' },
      { label: `Impedidos (${impeded})`, value: 'blocked' },
    ];
  });

  /**
   * O filtro esconde a seção inteira; a busca continua valendo dentro dela.
   *
   * Em "impedidos" as três seções somem e sobra a lista atravessada — por isso
   * ela devolve vazio aqui.
   */
  private inFilter(bucket: 'toCreate' | 'toUpdate' | 'toDeactivate', rows: ReconciliationRow[]): ReconciliationRow[] {
    const current = this.filter();
    if (current === 'blocked') return [];
    if (current !== 'all' && current !== bucket) return [];
    return this.visible(rows);
  }
  readonly unchanged = computed(() => this.data()?.unchanged ?? 0);

  /** Quantos estão travados por impedimento, somando os três baldes. */
  readonly blockedCount = computed(() =>
    this.allRows().filter(row => !canApply(row)).length);

  readonly selectedCount = computed(() => this.selected().size);

  private allRows(): ReconciliationRow[] {
    const data = this.data();
    if (!data) return [];
    return [...data.toCreate, ...data.toUpdate, ...data.toDeactivate];
  }

  /** A busca olha nome e código — é como se procura um cliente. */
  private visible(rows: ReconciliationRow[]): ReconciliationRow[] {
    const term = this.search().trim().toLowerCase();
    if (!term) return rows;

    return rows.filter(row =>
      row.name?.toLowerCase().includes(term) || row.code.includes(term));
  }

  // ── Buscar ────────────────────────────────────────────────────────────────

  load(): void {
    if (this.state() === 'loading') return;

    this.state.set('loading');
    this.errorMessage.set(null);
    this.selected.set(new Set());

    this.service.preview(this.months()).subscribe({
      next: data => {
        this.data.set(data);
        this.state.set('reviewing');
      },
      error: error => {
        this.errorMessage.set(error?.error?.message ?? 'Não foi possível consultar o Sankhya.');
        this.state.set('error');
      },
    });
  }

  // ── Seleção ───────────────────────────────────────────────────────────────

  isSelected(row: ReconciliationRow): boolean {
    return this.selected().has(row.code);
  }

  toggle(row: ReconciliationRow): void {
    // Linha impedida não entra nem por clique direto: o servidor recusaria, e
    // deixar marcar prometeria algo que não acontece.
    if (!canApply(row)) return;

    this.selected.update(current => {
      const next = new Set(current);
      next.has(row.code) ? next.delete(row.code) : next.add(row.code);
      return next;
    });
  }

  /**
   * Marca todos de uma seção — **os que estão filtrados, e pulando os
   * impedidos.**
   *
   * Marcar o que a busca escondeu aplicaria o que ninguém viu; marcar impedido
   * prometeria uma gravação que o servidor recusa.
   */
  toggleAll(bucket: Bucket): void {
    const rows = this.rowsOf(bucket).filter(canApply);
    const allOn = rows.length > 0 && rows.every(row => this.selected().has(row.code));

    this.selected.update(current => {
      const next = new Set(current);
      rows.forEach(row => allOn ? next.delete(row.code) : next.add(row.code));
      return next;
    });
  }

  allSelected(bucket: Bucket): boolean {
    const rows = this.rowsOf(bucket).filter(canApply);
    return rows.length > 0 && rows.every(row => this.selected().has(row.code));
  }

  private rowsOf(bucket: Bucket): ReconciliationRow[] {
    if (bucket === 'toCreate') return this.toCreate();
    if (bucket === 'toUpdate') return this.toUpdate();
    return this.toDeactivate();
  }

  /** A conta que o rodapé mostra antes de aplicar. */
  readonly tally = computed(() => {
    const chosen = this.selected();
    const data = this.data();
    if (!data) return { created: 0, updated: 0, deactivated: 0 };

    return {
      created: data.toCreate.filter(r => chosen.has(r.code)).length,
      updated: data.toUpdate.filter(r => chosen.has(r.code)).length,
      deactivated: data.toDeactivate.filter(r => chosen.has(r.code)).length,
    };
  });

  // ── Aplicar ───────────────────────────────────────────────────────────────

  apply(): void {
    const data = this.data();
    const chosen = this.selected();
    if (!data || chosen.size === 0 || this.state() === 'applying') return;

    // Vai código e assinatura: é ela que faz o servidor recusar uma linha que
    // mudou no ERP desde que esta tela foi aberta.
    const choices = this.allRows()
      .filter(row => chosen.has(row.code))
      .map(row => ({ code: row.code, signature: row.signature }));

    this.state.set('applying');

    this.service.apply(this.months(), choices).subscribe({
      next: result => {
        const done = result.created + result.updated + result.deactivated;
        this.toast.add({
          severity: result.skipped > 0 ? 'warn' : 'success',
          summary: `${done} aplicada(s)`,
          detail: result.skipped > 0
            ? `${result.skipped} não foram aplicadas — veja os motivos na lista.`
            : 'O cadastro está igual ao Sankhya.',
        });

        result.lines.forEach(line => this.toast.add({
          severity: 'warn',
          summary: `${line.code} ${line.name ?? ''}`.trim(),
          detail: line.detail,
        }));

        this.applied.emit();
        this.load();
      },
      error: error => {
        this.state.set('reviewing');
        this.toast.add({
          severity: 'error',
          summary: 'Erro',
          detail: error?.error?.message ?? 'Não foi possível aplicar.',
        });
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
