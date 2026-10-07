import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { EmailQueueService } from '../../../../infrastructure/services/email/email-queue.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import {
  EmailDetail,
  EmailOrigin,
  EmailRow,
  EmailStatus,
  EmailStatusFilter,
  EmailSummary,
  FailureKind,
  FailureReason,
  MAX_ATTEMPTS,
  ORIGIN_LABELS,
  ORIGIN_ORDER,
  PERIOD_OPTIONS,
  PeriodDays,
  activityText,
  attemptDots,
  attemptsTone,
  barPercent,
  buildChart,
  fileSize,
  filterByFailure,
  formatDecimal,
  isAddressFailure,
  isFailed,
  lastEventText,
  minutesWaiting,
  onlyFailedSelection,
  originLabel,
  selectableIds,
  canBeResent,
  shortStamp,
  statusChips,
  statusInfo,
} from '../../../../domain/models/email/email-queue.model';
import { formatStampBr } from '../../../../domain/utils/date-only';
import { apiMessage } from '../../../../domain/utils/api-error';

const SCREEN = 'dev/email-queue';
/** Uma página só, grande: a lista pagina na tela, e o filtro por motivo precisa da página inteira. */
const PAGE_SIZE = 200;

/**
 * Fila de e-mails: o que falhou, o que espera e o que saiu.
 *
 * Mockup aprovado em 2026-10-07, sem a parte de entrega (fica para outra fase):
 * "Enviado" aqui é o servidor SMTP ter aceitado. Os indicadores, os motivos de
 * erro e os chips filtram a lista; a ficha mostra o erro e permite reenviar.
 */
@Component({
  selector: 'app-email-queue',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, RouterLinkActive, Toast, InputTextModule,
    PkButtonComponent, PkDialogComponent, PkSheetComponent, PkTableComponent, PkSegmentedComponent, PkCanDirective,
  ],
  templateUrl: './email-queue.component.html',
  styleUrl: './email-queue.component.scss',
  providers: [MessageService],
})
export class EmailQueueComponent implements OnInit {
  private readonly service = inject(EmailQueueService);
  private readonly permissions = inject(PermissionStore);
  private readonly messages = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly ehCelular = ehCelular();
  readonly periodOptions = PERIOD_OPTIONS;
  readonly originOptions = ORIGIN_ORDER.map(o => ({ value: o, label: ORIGIN_LABELS[o] }));
  readonly maxAttempts = MAX_ATTEMPTS;

  // ── Indicadores ──
  readonly period = signal<PeriodDays>(7);
  readonly summary = signal<EmailSummary | null>(null);
  readonly summaryLoading = signal(false);
  /** Resumo do período da LISTA, para as contagens dos chips (pode ser outro período). */
  readonly listSummary = signal<EmailSummary | null>(null);

  // ── Lista ──
  readonly listDays = signal<PeriodDays>(7);
  readonly status = signal<EmailStatusFilter>(null);
  readonly reason = signal<FailureKind | null>(null);
  readonly origin = signal<EmailOrigin | null>(null);
  readonly search = signal('');
  readonly rows = signal<EmailRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly bulkConfirm = signal(false);
  readonly busy = signal(false);

  // ── Ficha ──
  readonly openedRow = signal<EmailRow | null>(null);
  readonly detail = signal<EmailDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly confirmResend = signal(false);

  readonly canResend = computed(() => this.permissions.can(SCREEN, 'ALTERAR'));

  /** O motivo filtra na tela, sobre a página carregada — ver `filterByFailure`. */
  readonly visibleRows = computed(() => filterByFailure(this.rows(), this.reason()));
  readonly failedVisible = computed(() => selectableIds(this.visibleRows()));
  readonly selectedIds = computed(() => onlyFailedSelection(this.selected(), this.visibleRows()));
  readonly allSelected = computed(() => {
    const ids = this.failedVisible();
    const sel = this.selected();
    return ids.length > 0 && ids.every(id => sel.has(id));
  });

  readonly chart = computed(() => buildChart(this.summary()?.perDay ?? []));
  readonly chips = computed(() => statusChips(this.listSummary()));
  readonly maxReason = computed(() => Math.max(1, ...(this.summary()?.reasons ?? []).map(r => r.count)));
  readonly originsSorted = computed(() => [...(this.summary()?.origins ?? [])].sort((a, b) => b.total - a.total));
  readonly waiting = computed(() => minutesWaiting(this.summary()?.oldestQueuedAt ?? null));
  readonly activity = computed(() => activityText(this.summary()?.lastActivityAt));
  readonly reasonLabel = computed(() => {
    const k = this.reason();
    return k ? (this.summary()?.reasons.find(r => r.kind === k)?.label ?? k) : null;
  });

  readonly detailBody = computed<SafeHtml | null>(() => {
    const d = this.detail();
    // O iframe é `sandbox=""`: sem script, sem formulário, sem navegação. O bypass
    // só diz ao Angular para não reescrever o HTML do e-mail — quem isola é o sandbox.
    return d?.body ? this.sanitizer.bypassSecurityTrustHtml(d.body) : null;
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => { if (this.searchTimer) clearTimeout(this.searchTimer); });
  }

  ngOnInit(): void {
    this.loadSummary();
    this.loadList();
  }

  // ── Carga ──

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.service.summary(this.period()).subscribe({
      next: s => {
        this.summary.set(s);
        this.summaryLoading.set(false);
        if (this.listDays() === this.period()) this.listSummary.set(s);
      },
      error: (err: HttpErrorResponse) => {
        this.summaryLoading.set(false);
        this.fail(err, 'Não foi possível carregar os indicadores.');
      },
    });
  }

  loadList(): void {
    this.loading.set(true);
    this.service.list({
      status: this.status(), origin: this.origin(), days: this.listDays(), q: this.search(), page: 0, size: PAGE_SIZE,
    }).subscribe({
      next: page => {
        this.rows.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
        this.selected.set(new Set(onlyFailedSelection(this.selected(), page.items)));
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.fail(err, 'Não foi possível carregar os e-mails.');
      },
    });
    this.loadListSummary();
  }

  private loadListSummary(): void {
    const days = this.listDays();
    const s = this.summary();
    if (s && s.days === days) {
      this.listSummary.set(s);
      return;
    }
    this.service.summary(days).subscribe({ next: r => this.listSummary.set(r), error: () => this.listSummary.set(null) });
  }

  refresh(): void {
    this.loadSummary();
    this.loadList();
  }

  // ── Filtros ──

  setPeriod(days: PeriodDays): void {
    this.period.set(days);
    this.loadSummary();
  }

  /** Indicador clicado: filtra a lista no mesmo período; clicar de novo limpa. */
  toggleKpi(key: 'FAILED' | 'QUEUE' | 'SENT'): void {
    this.reason.set(null);
    this.status.set(this.status() === key ? null : key);
    this.listDays.set(this.period());
    this.bulkConfirm.set(false);
    this.loadList();
  }

  toggleReason(r: FailureReason): void {
    const same = this.reason() === r.kind;
    this.reason.set(same ? null : r.kind);
    this.status.set(same ? null : 'FAILED');
    this.listDays.set(this.period());
    this.bulkConfirm.set(false);
    this.loadList();
  }

  setStatus(key: EmailStatus | null): void {
    this.status.set(key);
    this.reason.set(null);
    this.bulkConfirm.set(false);
    this.loadList();
  }

  clearFilter(): void {
    this.setStatus(null);
  }

  setOrigin(origin: EmailOrigin | ''): void {
    this.origin.set(origin || null);
    this.loadList();
  }

  setListDays(days: number | string): void {
    this.listDays.set(Number(days) as PeriodDays);
    this.loadList();
  }

  onSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadList(), 300);
  }

  chipPressed(key: EmailStatus | null): boolean {
    return this.status() === key;
  }

  // ── Seleção ──

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggleSelect(row: EmailRow, checked: boolean): void {
    if (!canBeResent(row)) return;
    const next = new Set(this.selected());
    if (checked) next.add(row.id); else next.delete(row.id);
    this.selected.set(next);
    this.bulkConfirm.set(false);
  }

  toggleAll(checked: boolean): void {
    const next = new Set(this.selected());
    for (const id of this.failedVisible()) { if (checked) next.add(id); else next.delete(id); }
    this.selected.set(next);
    this.bulkConfirm.set(false);
  }

  clearSelection(): void {
    this.selected.set(new Set());
    this.bulkConfirm.set(false);
  }

  /** Só depois do "Reenviar N" da confirmação. */
  resendSelected(): void {
    const ids = this.selectedIds();
    if (!ids.length || this.busy() || !this.canResend()) return;
    this.busy.set(true);
    this.service.resendMany(ids).subscribe({
      next: ({ requeued }) => {
        this.busy.set(false);
        this.bulkConfirm.set(false);
        this.selected.set(new Set());
        this.messages.add({ severity: 'success', summary: 'De volta na fila', detail: `${requeued} e-mail(s) voltaram para a fila.` });
        this.refresh();
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.fail(err, 'Não foi possível reenviar.'); },
    });
  }

  // ── Ficha ──

  open(row: EmailRow, askResend = false): void {
    this.openedRow.set(row);
    this.detail.set(null);
    this.detailError.set(null);
    this.confirmResend.set(askResend && canBeResent(row) && this.canResend());
    this.detailLoading.set(true);
    this.service.get(row.id).subscribe({
      next: d => {
        if (this.openedRow()?.id !== row.id) return;
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.detailLoading.set(false);
        this.detailError.set(apiMessage(err) ?? 'Não foi possível abrir o e-mail.');
      },
    });
  }

  closeDetail(): void {
    this.openedRow.set(null);
    this.detail.set(null);
    this.confirmResend.set(false);
  }

  askResend(): void {
    this.confirmResend.set(true);
  }

  /** Só depois do "Reenviar" da confirmação na ficha. */
  resendOpened(): void {
    const row = this.openedRow();
    if (!row || !canBeResent(row) || this.busy() || !this.canResend()) return;
    this.busy.set(true);
    this.service.resend(row.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeDetail();
        this.messages.add({ severity: 'success', summary: 'De volta na fila', detail: 'O agendador envia na próxima passada.' });
        this.refresh();
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.fail(err, 'Não foi possível reenviar.'); },
    });
  }

  // ── Leitura ──

  info(status: string) { return statusInfo(status); }
  originOf(origin: string | null, label: string | null): string { return originLabel(origin, label); }
  dots(row: EmailRow) { return attemptDots(row.attempts); }
  tone(row: EmailRow) { return attemptsTone(row.status); }
  failed(row: EmailRow): boolean { return isFailed(row); }
  resendable(row: EmailRow): boolean { return canBeResent(row); }
  lastEvent(row: EmailRow): string { return lastEventText(row); }
  hasError(row: EmailRow): boolean { return row.status !== 'SENT' && !!(row.failureLabel || row.lastError); }
  addressFailure(kind: string | null): boolean { return isAddressFailure(kind); }
  stamp(iso: string | null): string { return formatStampBr(iso); }
  short(iso: string | null): string { return shortStamp(iso); }
  size(bytes: number): string { return fileSize(bytes); }
  pct(n: number, max: number): number { return barPercent(n, max); }
  dec(n: number | null | undefined, digits = 1): string { return formatDecimal(n, digits); }
  /** Primeira linha do erro de exemplo: o nome da exceção ou o código SMTP. */
  code(sample: string | null): string { return (sample ?? '').split(':')[0]; }
  localPart(to: string): string { return to.split('@')[0]; }

  private fail(err: HttpErrorResponse, fallback: string): void {
    this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? fallback });
  }
}
