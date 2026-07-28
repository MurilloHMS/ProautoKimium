import { Component, OnInit, inject, ViewChildren, QueryList, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { DatePickerModule } from 'primeng/datepicker';
import { TabsModule } from 'primeng/tabs';
import { CheckboxModule } from 'primeng/checkbox';
import { PopoverModule } from 'primeng/popover';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmationService, MessageService } from 'primeng/api';

import { RentReceiptService } from '../../../../infrastructure/services/rentReceiptService/rent-receipt.service';
import {
  GenerationMode,
  MatrizPreviewDTO,
  ReceiptBatchDetail,
  ReceiptBatchSummary,
  ReceiptRow,
} from '../../../../domain/models/rentReceipt.model';

@Component({
  selector: 'app-rent-receipt-generator',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TableModule, ToastModule, ConfirmDialogModule,
    DatePickerModule, TabsModule, CheckboxModule,
    PopoverModule, ProgressBarModule, TooltipModule, InputTextModule,
    ProgressSpinnerModule, PkComboboxComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './rent-receipt-generator.component.html',
  styleUrl: './rent-receipt-generator.component.scss',
})
export class RentReceiptGeneratorComponent implements OnInit, AfterViewChecked {
  private service = inject(RentReceiptService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  @ViewChildren('nameInput') nameInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // Upload
  uploading = false;
  fileName = '';
  processId = '';
  rawMatrizes: MatrizPreviewDTO[] = [];

  // Table
  rows: ReceiptRow[] = [];
  mode: GenerationMode = 'MATRIZ';
  readonly modeOptions = [
    { label: 'Por Matriz', value: 'MATRIZ' as GenerationMode },
    { label: 'Por Unidade', value: 'UNIDADE' as GenerationMode },
  ];

  // Filters
  selectedMonth = '';
  selectedYear: number = new Date().getFullYear();
  readonly meses = [
    'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  readonly years: number[] = [];

  // Search
  searchTerm = '';
  filteredRows: ReceiptRow[] = [];

  // Batch date
  batchDate: Date | null = null;

  // Generate
  generating = false;

  // History
  historyLoading = false;
  batches: ReceiptBatchSummary[] = [];
  expandedBatch: ReceiptBatchDetail | null = null;
  expandedBatchId: string | null = null;
  historyMonth = '';
  historyYear: number | null = null;

  // Focus management
  private pendingFocusId: string | null = null;

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      this.years.push(y);
    }
  }

  ngAfterViewChecked(): void {
    if (this.pendingFocusId) {
      const input = this.nameInputs?.find(
        el => el.nativeElement.dataset['rowId'] === this.pendingFocusId
      );
      if (input) {
        input.nativeElement.focus();
        input.nativeElement.select();
        this.pendingFocusId = null;
      }
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.fileName = file.name;
    this.uploading = true;

    this.service.uploadFile(file).subscribe({
      next: res => {
        this.processId = res.processId;
        this.rawMatrizes = res.matrizes;
        this.buildRows();
        this.uploading = false;
        input.value = '';
      },
      error: () => {
        this.uploading = false;
        input.value = '';
        this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao processar a planilha.' });
      },
    });
  }

  // ── Mode toggle ─────────────────────────────────────────────────────────────

  onModeChange(): void {
    this.buildRows();
  }

  private buildRows(): void {
    let id = 0;
    this.rows = [];

    if (this.mode === 'MATRIZ') {
      for (const m of this.rawMatrizes) {
        this.rows.push({
          id: `m-${id++}`,
          type: 'MATRIZ',
          code: m.codMatriz,
          name: m.nomeMatriz,
          originalName: m.nomeMatriz,
          totalMaquinas: m.totalMaquinas,
          totalAmount: m.totalMatriz,
          dataVencimento: null,
          selected: true,
          editingName: false,
          editingDate: false,
          codMatriz: m.codMatriz,
        });
      }
    } else {
      for (const m of this.rawMatrizes) {
        if (!m.unidades?.length) {
          this.rows.push({
            id: `m-${id++}`,
            type: 'UNIDADE',
            code: m.codMatriz,
            name: m.nomeMatriz,
            originalName: m.nomeMatriz,
            totalMaquinas: m.totalMaquinas,
            totalAmount: m.totalMatriz,
            dataVencimento: null,
            selected: true,
            editingName: false,
            editingDate: false,
            codMatriz: m.codMatriz,
          });
          continue;
        }
        for (const u of m.unidades) {
          this.rows.push({
            id: `u-${id++}`,
            type: 'UNIDADE',
            code: u.numNota,
            name: u.nomeParceiro,
            originalName: u.nomeParceiro,
            totalMaquinas: u.quantidadeMaquinas,
            totalAmount: u.vlrDesdobramento,
            dataVencimento: null,
            selected: true,
            editingName: false,
            editingDate: false,
            codMatriz: m.codMatriz,
            parentMatrizName: m.nomeMatriz,
          });
        }
      }
    }

    this.searchTerm = '';
    this.filteredRows = this.rows;
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredRows = this.rows;
      return;
    }
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredRows = this.rows.filter(r =>
      r.name.toLowerCase().includes(term) ||
      r.code.toLowerCase().includes(term) ||
      r.codMatriz.toLowerCase().includes(term) ||
      (r.parentMatrizName && r.parentMatrizName.toLowerCase().includes(term))
    );
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredRows = this.rows;
  }

  // ── Selection ───────────────────────────────────────────────────────────────

  get allSelected(): boolean {
    return this.rows.length > 0 && this.rows.every(r => r.selected);
  }

  get someSelected(): boolean {
    return this.rows.some(r => r.selected) && !this.allSelected;
  }

  get selectedCount(): number {
    return this.rows.filter(r => r.selected).length;
  }

  toggleAll(checked: boolean): void {
    this.rows.forEach(r => r.selected = checked);
  }

  // ── Inline Editing ──────────────────────────────────────────────────────────

  startEditName(row: ReceiptRow): void {
    if (row.editingName) return;
    row.editingName = true;
    this.pendingFocusId = row.id;
  }

  stopEditName(row: ReceiptRow): void {
    row.editingName = false;
    row.name = row.name.trim() || row.originalName;
  }

  cancelEditName(row: ReceiptRow): void {
    row.name = row.originalName;
    row.editingName = false;
  }

  startEditDate(row: ReceiptRow): void {
    row.editingDate = true;
  }

  onDateSelect(row: ReceiptRow): void {
    setTimeout(() => row.editingDate = false, 150);
  }

  // ── Batch Date ──────────────────────────────────────────────────────────────

  applyBatchDate(): void {
    if (!this.batchDate) return;
    this.rows.filter(r => r.selected).forEach(r => r.dataVencimento = new Date(this.batchDate!));
    this.toast.add({
      severity: 'success', summary: 'Datas aplicadas',
      detail: `Vencimento definido para ${this.selectedCount} recibos.`,
    });
    this.batchDate = null;
  }

  clearAllDates(): void {
    this.confirm.confirm({
      header: 'Limpar Datas',
      message: 'Apagar todas as datas de vencimento?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Nao',
      accept: () => {
        this.rows.forEach(r => r.dataVencimento = null);
        this.toast.add({ severity: 'info', summary: 'Datas limpas' });
      },
    });
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  get validationErrors(): string[] {
    const errors: string[] = [];
    if (!this.selectedMonth) errors.push('Selecione o mes de referencia');
    if (!this.selectedYear) errors.push('Selecione o ano de referencia');
    const selected = this.rows.filter(r => r.selected);
    if (selected.length === 0) errors.push('Nenhum recibo selecionado para geracao');
    const withoutDate = selected.filter(r => !r.dataVencimento);
    if (withoutDate.length > 0) {
      errors.push(`${withoutDate.length} recibo(s) selecionado(s) sem data de vencimento`);
    }
    return errors;
  }

  get isValid(): boolean {
    return this.validationErrors.length === 0;
  }

  get validationSummary(): { label: string; ok: boolean }[] {
    const selected = this.rows.filter(r => r.selected);
    const withoutDate = selected.filter(r => !r.dataVencimento);
    return [
      { label: this.selectedMonth && this.selectedYear
          ? `Referencia: ${this.selectedMonth}/${this.selectedYear}`
          : 'Selecione mes e ano de referencia', ok: !!this.selectedMonth && !!this.selectedYear },
      { label: `${selected.length} de ${this.rows.length} recibos selecionados`,
        ok: selected.length > 0 },
      { label: withoutDate.length === 0
          ? 'Todos os recibos com data de vencimento'
          : `${withoutDate.length} recibo(s) sem data de vencimento`,
        ok: withoutDate.length === 0 },
    ];
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  generate(): void {
    if (!this.isValid) return;

    const selected = this.rows.filter(r => r.selected);
    const excluded = this.rows.filter(r => !r.selected);

    const vencimentos: Record<string, string> = {};
    const nomeOverrides: Record<string, string> = {};

    selected.forEach(r => {
      if (r.dataVencimento) vencimentos[r.code] = this.formatDate(r.dataVencimento);
      if (r.name !== r.originalName) nomeOverrides[r.code] = r.name;
    });

    this.generating = true;

    // Use v2 if backend supports it, fallback to v1
    const request = {
      processId: this.processId,
      mesReferencia: this.selectedMonth,
      anoReferencia: this.selectedYear,
      mode: this.mode,
      vencimentos,
      nomeOverrides,
      excludedKeys: excluded.map(r => r.code),
    };

    this.service.generateReceiptsV2(request).subscribe({
      next: blob => {
        this.triggerDownload(blob, `recibos-${this.selectedMonth}-${this.selectedYear}.zip`);
        this.generating = false;
        this.toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Recibos gerados com sucesso.' });
      },
      error: () => {
        this.generating = false;
        this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao gerar os recibos.' });
      },
    });
  }

  // ── History ─────────────────────────────────────────────────────────────────

  loadHistory(): void {
    this.historyLoading = true;
    this.expandedBatch = null;
    this.expandedBatchId = null;
    this.service.getReceiptBatches(
      this.historyMonth || undefined,
      this.historyYear || undefined,
    ).subscribe({
      next: data => { this.batches = data; this.historyLoading = false; },
      error: () => {
        this.historyLoading = false;
        this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar historico.' });
      },
    });
  }

  toggleBatchDetail(batch: ReceiptBatchSummary): void {
    if (this.expandedBatchId === batch.id) {
      this.expandedBatchId = null;
      this.expandedBatch = null;
      return;
    }
    this.expandedBatchId = batch.id;
    this.service.getReceiptBatchDetail(batch.id).subscribe({
      next: detail => this.expandedBatch = detail,
      error: () => this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar detalhes.' }),
    });
  }

  downloadBatch(batchId: string, month: string, year: number): void {
    this.service.downloadBatchZip(batchId).subscribe({
      next: blob => this.triggerDownload(blob, `recibos-${month}-${year}.zip`),
      error: () => this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha no download.' }),
    });
  }

  downloadReceipt(receiptId: string, filename: string): void {
    this.service.downloadSingleReceipt(receiptId).subscribe({
      next: blob => this.triggerDownload(blob, filename),
      error: () => this.toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha no download.' }),
    });
  }

  onTabChange(index: string | number | undefined): void {
    if (index === 1 && this.batches.length === 0) {
      this.loadHistory();
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private formatDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  formatDateDisplay(d: Date | null): string {
    if (!d) return '--';
    return this.formatDate(d);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  isDirty(row: ReceiptRow): boolean {
    return row.name !== row.originalName;
  }

  resetFile(): void {
    this.processId = '';
    this.fileName = '';
    this.rawMatrizes = [];
    this.rows = [];
  }
}
