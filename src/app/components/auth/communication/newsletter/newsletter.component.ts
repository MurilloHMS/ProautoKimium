import { Component, OnInit } from '@angular/core';
import { Newsletter } from '../../../../domain/models/newsletter.model';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FileUploadEvent, FileUploadModule } from 'primeng/fileupload';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-newsletter',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    FileUploadModule,
    ToastModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    ConfirmDialogModule,
    ToolbarModule,
    DividerModule,
    BadgeModule
  ],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
  providers: [MessageService, ConfirmationService]
})
export class NewsletterComponent implements OnInit {

  loading = false;
  processing = false;
  newsletters: Newsletter[] = [];

  arquivoProdutos: File | null = null;
  arquivoVisitas: File | null = null;
  arquivoNotas: File | null = null;
  arquivoPecas: File | null = null;

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) { }

  ngOnInit(): void {

  }

  onUpload($event: FileUploadEvent) {
    throw new Error('Method not implemented.');
  }

  loadNewsletters(): void {
     this.loading = true;
    this.http.get<Newsletter[]>('').subscribe({
      next: (data) => {
        this.newsletters = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar newsletters:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Erro ao carregar newsletters'
        });
        this.loading = false;
      }
    });
  }

  onFileSelected(event: any, type: string): void {
    const file: File = event.files[0];

    if(!file) return;

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];

    const filename = file.name.toLowerCase();
    const isExcel = validTypes.includes(file.type) || filename.endsWith('.xls') || filename.endsWith('.xlsx') || filename.endsWith('.xlsm');

    if (!isExcel) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Por favor, selecione apenas arquivos Excel (.xls, .xlsx ou .xlsm)'
      });
      event.clear();
      return;
    }

    switch (type) {
      case 'produtos':
        this.arquivoProdutos = file;
        break;
      case 'visitas':
        this.arquivoVisitas = file;
        break;
      case 'notas':
        this.arquivoNotas = file;
        break;
      case 'pecas':
        this.arquivoPecas = file;
        break;
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: `Arquivo ${file.name} selecionado com sucesso`
    });
  }

  removeFile(tipo: string): void {
    switch (tipo) {
      case 'produtos':
        this.arquivoProdutos = null;
        break;
      case 'visitas':
        this.arquivoVisitas = null;
        break;
      case 'notas':
        this.arquivoNotas = null;
        break;
      case 'pecas':
        this.arquivoPecas = null;
        break;
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Arquivo Removido',
      detail: 'Arquivo removido com sucesso'
    });
  }

  allFilesSelected(): boolean {
    return !!(this.arquivoProdutos && this.arquivoVisitas && this.arquivoNotas && this.arquivoPecas);
  }

  processFiles(): void {
    if (!this.allFilesSelected()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Por favor, selecione todos os arquivos antes de processar'
      });
      return;
    }

    this.confirmationService.confirm({
      message: 'Deseja processar os arquivos Excel e gerar as newsletters?',
      header: 'Confirmação',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.sendFiles();
      }
    });
  }

  sendFiles(): void {
    this.processing = true;

    const formData = new FormData();

    formData.append('arquivoProdutos', this.arquivoProdutos!);
    formData.append('arquivoVisitas', this.arquivoVisitas!);
    formData.append('arquivoNotas', this.arquivoNotas!);
    formData.append('arquivoPecas', this.arquivoPecas!);

    this.http.post<Newsletter[]>(`${''}/processar`, formData).subscribe({
      next: (newsletters) => {
        this.newsletters = newsletters;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: `${newsletters.length} newsletter(s) processada(s) com sucesso!`
        });
        this.limparArquivos();
        this.processing = false;
      },
      error: (error) => {
        console.error('Erro ao processar arquivos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: error.error?.message || 'Erro ao processar arquivos. Verifique o formato dos arquivos e tente novamente.'
        });
        this.processing = false;
      }
    });
  }

   limparArquivos(): void {
    this.arquivoProdutos = null;
    this.arquivoVisitas = null;
    this.arquivoNotas = null;
    this.arquivoPecas = null;
  }

  limparTudo(): void {
    this.confirmationService.confirm({
      message: 'Deseja limpar todos os arquivos selecionados?',
      header: 'Confirmação',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.limparArquivos();
        this.messageService.add({
          severity: 'info',
          summary: 'Limpo',
          detail: 'Todos os arquivos foram removidos'
        });
      }
    });
  }

  getStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ENVIADO':
        return 'success';
      case 'PENDENTE':
        return 'warning';
      case 'ERRO':
        return 'danger';
      case 'CANCELADO':
        return 'info';
      default:
        return 'secondary';
    }
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  formatarData(data: string): string {
    if (!data) return '';
    const date = new Date(data);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  exportarExcel(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Funcionalidade de exportação em desenvolvimento'
    });
  }
}
