import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkFileUploadComponent } from '../../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { PkPasswordComponent } from '../../../../theme/ProautoKimium/pk-password/pk-password.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { PdfToolsService, downloadFileResponse } from '../../../../../infrastructure/services/tools/pdf-tools.service';
import { pdfTool } from '../pdf-tools.catalog';

@Component({
  selector: 'app-pdf-unlock',
  standalone: true,
  imports: [FormsModule, Toast, PageHeaderComponent, PkFileUploadComponent, PkPasswordComponent, PkButtonComponent],
  templateUrl: './pdf-unlock.component.html',
  styleUrl: './pdf-unlock.component.scss',
  providers: [MessageService],
})
export class PdfUnlockComponent {

  private readonly service = inject(PdfToolsService);
  private readonly messageService = inject(MessageService);

  /** Título e descrição saem do catálogo, os mesmos que o hub mostra no cartão. */
  readonly tool = pdfTool('unlock');

  readonly file = signal<File | null>(null);
  readonly processing = signal(false);
  password = '';

  onFilesSelected(files: File[]): void {
    this.file.set(files[0] ?? null);
  }

  onCleared(): void {
    this.file.set(null);
  }

  get canSubmit(): boolean {
    return !!this.file() && this.password.trim().length > 0 && !this.processing();
  }

  unlock(): void {
    const file = this.file();
    if (!file || !this.canSubmit) return;

    this.processing.set(true);

    this.service.unlock(file, this.password).subscribe({
      next: (response) => {
        this.processing.set(false);

        // 200 com corpo vazio acontece quando a API não reconhece o PDF como
        // protegido. Sem este aviso, o usuário baixa 0 byte achando que deu certo.
        if (!downloadFileResponse(response, this.suggestedName(file))) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Nada para desbloquear',
            detail: 'O servidor respondeu vazio — provavelmente este PDF não tem senha.',
          });
          return;
        }

        this.messageService.add({
          severity: 'success',
          summary: 'PDF desbloqueado',
          detail: 'O download começou automaticamente.',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.processing.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Não foi possível desbloquear',
          detail: this.errorMessage(err),
        });
      },
    });
  }

  /** Se o cabeçalho não vier, ao menos o arquivo baixa com um nome reconhecível. */
  private suggestedName(file: File): string {
    return file.name.replace(/\.pdf$/i, '') + '-desbloqueado.pdf';
  }

  /**
   * O corpo do erro é um Blob, porque a requisição pediu `blob` — ler o texto
   * dele daria uma Promise, e a mensagem chegaria depois do toast. Por isso o
   * texto vem do status, que é o que dá para saber na hora.
   */
  private errorMessage(err: HttpErrorResponse): string {
    switch (err.status) {
      case 0:   return 'Sem conexão com o servidor.';
      case 400: return 'Senha incorreta, ou o arquivo não é um PDF válido.';
      case 401:
      case 403: return 'Você não tem permissão para usar esta ferramenta.';
      case 413: return 'Arquivo grande demais.';
      case 500: return 'O servidor não conseguiu abrir este PDF. Confira a senha.';
      default:  return 'Falha inesperada ao processar o arquivo.';
    }
  }
}
