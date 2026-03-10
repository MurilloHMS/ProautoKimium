import {Component, computed, signal} from '@angular/core';
import {CommonModule} from "@angular/common";
import {HttpClient, HttpClientModule} from "@angular/common/http";
import {ButtonModule} from "primeng/button";
import {CardModule} from "primeng/card";
import {FileUploadModule} from "primeng/fileupload";
import {TableModule} from "primeng/table";
import {TagModule} from "primeng/tag";
import {ProgressBarModule} from "primeng/progressbar";
import {ToastModule} from "primeng/toast";
import {DividerModule} from "primeng/divider";
import {SkeletonModule} from "primeng/skeleton";
import {TooltipModule} from "primeng/tooltip";
import {BadgeModule} from "primeng/badge";
import {MessageModule} from "primeng/message";
import {PdfPageInfoExtractorDTO} from "../../../../domain/models/holerit.models";
import {MessageService} from "primeng/api";
import * as XLSX from 'xlsx';
import {environment} from "../../../../../environments/environment";

@Component({
  selector: 'app-holerit-extractor',
  imports: [
    CommonModule,
    HttpClientModule,
    ButtonModule,
    CardModule,
    FileUploadModule,
    TableModule,
    TagModule,
    ProgressBarModule,
    ToastModule,
    DividerModule,
    SkeletonModule,
    TooltipModule,
    BadgeModule,
    MessageModule,
  ],
  templateUrl: './holerit-extractor.component.html',
  styleUrl: './holerit-extractor.component.scss',
  providers: [MessageService]
})
export class HoleritExtractorComponent {
  private readonly API_URL = `${environment.apiUrl}/pdf/holerith/extract`;

  selectedFile = signal<File | null>(null);
  isLoading = signal(false);
  extractedData = signal<PdfPageInfoExtractorDTO[]>([]);
  hasError = signal(false);

  hasData = computed(() => this.extractedData().length > 0);

  totalInss = computed(() =>
    this.extractedData().reduce((s, r) => s + (r.inss ?? 0), 0)
  );
  totalIrrf = computed(() =>
    this.extractedData().reduce((s, r) => s + (r.irrf ?? 0), 0)
  );
  totalFgts = computed(() =>
    this.extractedData().reduce((s, r) => s + (r.fgts ?? 0), 0)
  );
  totalEmprestimo = computed(() =>
    this.extractedData().reduce((s, r) => s + (r.emprestimoTrabalhador ?? 0), 0)
  );

  financialColumns = [
    { field: 'inss', header: 'INSS' },
    { field: 'irrf', header: 'IRRF' },
    { field: 'inssFerias', header: 'INSS Férias' },
    { field: 'irrfFerias', header: 'IRRF Férias' },
    { field: 'inss13', header: 'INSS 13°' },
    { field: 'irrf13', header: 'IRRF 13°' },
    { field: 'fgts', header: 'FGTS' },
    { field: 'emprestimoTrabalhador', header: 'Empréstimo' },
  ];

  constructor(
    private http: HttpClient,
    private messageService: MessageService
  ) {}

  onFileSelect(event: any): void {
    const file: File = event.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile.set(file);
      this.hasError.set(false);
      this.extractedData.set([]);
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Arquivo inválido',
        detail: 'Selecione um arquivo PDF válido.',
      });
    }
  }

  onFileClear(): void {
    this.selectedFile.set(null);
    this.extractedData.set([]);
    this.hasError.set(false);
  }

  extractData(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isLoading.set(true);
    this.hasError.set(false);

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<PdfPageInfoExtractorDTO[]>(this.API_URL, formData).subscribe({
      next: (data) => {
        this.extractedData.set(data);
        this.isLoading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Extração concluída',
          detail: `${data.length} registro(s) extraído(s) com sucesso.`,
        });
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
        this.hasError.set(true);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro na extração',
          detail: 'Não foi possível processar o PDF. Tente novamente.',
        });
      },
    });
  }

  exportToExcel(): void {
    const data = this.extractedData();
    if (!data.length) return;

    const rows = data.map((r) => ({
      Nome: r.nome,
      Cargo: r.cargo,
      CPF: r.cpf,
      Empresa: r.empresa,
      Departamento: r.departamento,
      INSS: r.inss,
      IRRF: r.irrf,
      'INSS Férias': r.inssFerias,
      'IRRF Férias': r.irrfFerias,
      'INSS 13°': r.inss13,
      'IRRF 13°': r.irrf13,
      FGTS: r.fgts,
      'Empréstimo Trabalhador': r.emprestimoTrabalhador,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Style header row width
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extração PDF');

    const fileName = `extracao_pdf_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Excel gerado',
      detail: `Arquivo "${fileName}" baixado com sucesso.`,
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }

  formatCpf(cpf: string): string {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}
