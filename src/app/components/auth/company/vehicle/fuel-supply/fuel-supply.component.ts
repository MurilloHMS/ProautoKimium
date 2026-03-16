import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule }   from 'primeng/button';
import { SelectModule }   from 'primeng/select';
import { CardModule }     from 'primeng/card';
import { ToastModule }    from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RippleModule }   from 'primeng/ripple';
import { DividerModule }  from 'primeng/divider';

import {
  FORMAT_OPTIONS,
  FormatOption,
  FuelSupplyReportRequest,
  MONTH_OPTIONS,
  MonthOption,
  ReportFormat
} from '../../../../../domain/models/report.model';
import { FuelSuppyService } from '../../../../../infrastructure/services/company/vehicle/fuelSupply/fuel-suppy.service';

@Component({
  selector: 'app-fuel-supply-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    CardModule,
    ToastModule,
    RippleModule,
    DividerModule,
  ],
  providers: [MessageService],
  templateUrl: './fuel-supply.component.html',
  styleUrl: './fuel-supply.component.scss'
})
export class FuelSupplyComponent implements OnInit {

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ── Opções ────────────────────────────────────────────────────────────────
  monthOptions:  MonthOption[]  = MONTH_OPTIONS;
  formatOptions: FormatOption[] = FORMAT_OPTIONS;
  yearOptions:   number[]       = [];

  // ── Formulário ────────────────────────────────────────────────────────────
  selectedMonth:  number       = new Date().getMonth() + 1;
  selectedYear:   number       = new Date().getFullYear();
  selectedFormat: ReportFormat = 'PDF';

  // ── Upload ────────────────────────────────────────────────────────────────
  selectedFile: File | null = null;

  private uploadedPeriodKey: string | null = null;

  loadingUpload = false;
  loadingReport = false;

  constructor(
    private reportService: FuelSuppyService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.buildYearOptions();
  }

  private buildYearOptions(): void {
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 3; y--) {
      this.yearOptions.push(y);
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  get selectedMonthLabel(): string {
    return this.monthOptions.find(m => m.value === this.selectedMonth)?.label ?? '';
  }

  get fileSizeLabel(): string {
    if (!this.selectedFile) return '';
    const kb = this.selectedFile.size / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }

  /** O botão Gerar só fica ativo se o período atual já foi enviado com sucesso. */
  get canGenerate(): boolean {
    //return this.uploadedPeriodKey === this.currentPeriodKey;
    return true;
  }

  private get currentPeriodKey(): string {
    return `${this.selectedMonth}-${this.selectedYear}`;
  }

  // ── Arquivo ───────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.messageService.add({
        severity: 'warn',
        summary:  'Formato inválido',
        detail:   'Apenas arquivos .xlsx são aceitos.'
      });
      this.clearFile();
      return;
    }

    this.selectedFile = file;
  }

  clearFile(): void {
    this.selectedFile = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  upload(): void {
    if (!this.selectedFile || !this.selectedMonth || !this.selectedYear) {
      this.messageService.add({
        severity: 'warn',
        summary:  'Campos obrigatórios',
        detail:   'Selecione o mês, ano e a planilha antes de enviar.'
      });
      return;
    }

    this.loadingUpload = true;

    this.reportService
      .uploadSpreadsheet(this.selectedFile, this.selectedMonth, this.selectedYear)
      .subscribe({
        next: () => {
          // Marca o período como enviado e habilita o botão Gerar
          this.uploadedPeriodKey = this.currentPeriodKey;

          this.messageService.add({
            severity: 'success',
            summary:  'Planilha enviada',
            detail:   `Dados de ${this.selectedMonthLabel}/${this.selectedYear} importados. Você já pode gerar o relatório.`
          });

          this.clearFile();
          this.loadingUpload = false;
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary:  'Erro no upload',
            detail:   err.error ?? 'Não foi possível processar a planilha. Verifique o formato e tente novamente.'
          });
          this.loadingUpload = false;
        }
      });
  }

  // ── Geração ───────────────────────────────────────────────────────────────

  generate(): void {
    this.loadingReport = true;

    const request: FuelSupplyReportRequest = {
      month:    this.selectedMonth,
      year:    this.selectedYear,
      format: this.selectedFormat
    };

    this.reportService.generateReport(request).subscribe({
      next: (blob) => {
        this.reportService.downloadFile(blob, this.selectedFormat, this.selectedMonth, this.selectedYear);
        this.messageService.add({
          severity: 'success',
          summary:  'Relatório gerado',
          detail:   `Download iniciado — ${this.selectedMonthLabel}/${this.selectedYear}`
        });
        this.loadingReport = false;
      },
      error: (err) => {
        const detail = err.status === 204
          ? 'Nenhum registro encontrado para o período informado.'
          : 'Não foi possível gerar o relatório. Tente novamente.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail });
        this.loadingReport = false;
      }
    });
  }
}
