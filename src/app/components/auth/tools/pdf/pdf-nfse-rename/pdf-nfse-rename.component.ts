import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkFileUploadComponent } from '../../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { PdfToolsService, downloadFileResponse } from '../../../../../infrastructure/services/tools/pdf-tools.service';
import { pdfTool } from '../pdf-tools.catalog';

@Component({
  selector: 'app-pdf-nfse-rename',
  standalone: true,
  imports: [Toast, PageHeaderComponent, PkFileUploadComponent, PkButtonComponent],
  templateUrl: './pdf-nfse-rename.component.html',
  styleUrl: './pdf-nfse-rename.component.scss',
  providers: [MessageService],
})
export class PdfNfseRenameComponent {

  private readonly service = inject(PdfToolsService);
  private readonly messageService = inject(MessageService);

  readonly tool = pdfTool('nfse-rename');

  readonly files = signal<File[]>([]);
  readonly processing = signal(false);

  onFilesSelected(files: File[]): void {
    this.files.set(files);
  }

  onCleared(): void {
    this.files.set([]);
  }

  rename(): void {
    const files = this.files();
    if (files.length === 0 || this.processing()) return;

    this.processing.set(true);

    this.service.renameNfse(files).subscribe({
      next: (response) => {
        this.processing.set(false);

        if (!downloadFileResponse(response, 'nfse_renomeadas.zip')) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Nenhum arquivo retornado',
            detail: 'O servidor respondeu vazio — confira se os arquivos são NFS-e.',
          });
          return;
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Notas renomeadas',
          detail: `${files.length} arquivo(s) processado(s). O ZIP começou a baixar.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.processing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Não foi possível renomear',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  private errorMessage(err: HttpErrorResponse): string {
    switch (err.status) {
      case 0:   return 'Sem conexão com o servidor.';
      case 400: return 'Algum arquivo não é uma NFS-e válida.';
      case 401:
      case 403: return 'Você não tem permissão para usar esta ferramenta.';
      case 413: return 'O lote ficou grande demais. Tente em partes menores.';
      default:  return 'Falha inesperada ao processar os arquivos.';
    }
  }
}
