import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule, FileUploadHandlerEvent } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { MessageService } from 'primeng/api';
import { ExcelService } from '../../../../infrastructure/services/excel/excel.service';

@Component({
  selector: 'app-excel-credentials',
  standalone: true,
  imports: [
    CommonModule,
    FileUploadModule,
    ButtonModule,
    ToastModule,
    ProgressBarModule,
    BadgeModule,
  ],
  providers: [MessageService],
  templateUrl: './excel-credentials.component.html',
  styleUrl: './excel-credentials.component.scss',
})
export class ExcelCredentialsComponent {
  uploading = signal(false);

  constructor(
    private excelService: ExcelService,
    private messageService: MessageService
  ) {}

  onUpload(event: FileUploadHandlerEvent): void {
    const files: File[] = event.files;

    if (!files || files.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atenção',
        detail: 'Selecione ao menos um arquivo Excel.',
      });
      return;
    }

    this.uploading.set(true);

    this.excelService.processExcelFiles(files).subscribe({
      next: (blob) => {
        this.uploading.set(false);
        this.downloadZip(blob);
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Arquivos processados! O download do ZIP iniciara em breve.',
        });
      },
      error: () => {
        this.uploading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Falha ao processar os arquivos. Tente novamente.',
        });
      },
    });
  }

  private downloadZip(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'excel_sem_senha.zip';
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
