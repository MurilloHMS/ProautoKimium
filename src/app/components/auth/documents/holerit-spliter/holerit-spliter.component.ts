import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { animate, style, transition, trigger } from '@angular/animations';
import { PdfPageInfo } from '../../../../domain/models/hr/holerite.model';
import { HoleriteService } from '../../../../infrastructure/services/hr/holerite.service';
import {PkButtonComponent} from "../../../theme/ProautoKimium/pk-button/pk-button.component";
import {PkFileUploadComponent} from "../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component";

interface PageItem extends PdfPageInfo {
  originalName: string;
}

@Component({
  selector: 'app-holerit-spliter',
  imports: [
    CommonModule,
    FormsModule,
    FileUploadModule,
    ButtonModule,
    InputTextModule,
    ProgressSpinnerModule,
    TooltipModule,
    PkButtonComponent,
    PkFileUploadComponent,
  ],
  templateUrl: './holerit-spliter.component.html',
  styleUrl: './holerit-spliter.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class HoleritSpliterComponent {
  // Só separa e baixa o ZIP. Vincular ao funcionário é a ferramenta "Enviar
  // holerites", que confere antes de gravar — misturar as duas na mesma tela
  // era o que fazia o RH publicar sem ver o que ia acontecer.
  selectedFile: File | null = null;
  uploadId = '';
  pages: PageItem[] = [];
  isUploading = false;
  isSaving = false;

  constructor(
    private service: HoleriteService,
    private messageService: MessageService
  ) {}

  onFileSelect(files: File[]): void {
    const file = files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadPdf();
    }
  }

  uploadPdf(): void {
    if (!this.selectedFile) {
      this.showError('Nenhum arquivo selecionado');
      return;
    }

    this.isUploading = true;
    this.pages = [];
    this.uploadId = '';

    this.service.separarPdf(this.selectedFile)
      .subscribe({
        next: (response) => {
          this.uploadId = response.uploadId;
          this.pages = response.pages.map(page => ({
            name: page.name,
            originalName: page.name,
          }));
          this.isUploading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Upload concluído',
            detail: `${this.pages.length} página(s) extraída(s) com sucesso.`,
            life: 4000
          });
        },
        error: (error) => {
          this.isUploading = false;
          this.showError(error.error || 'Erro ao enviar o arquivo');
        }
      });
  }

  saveRenamedPages(): void {
    if (!this.uploadId || this.pages.length === 0) {
      this.showError('Nenhum arquivo para salvar');
      return;
    }

    this.isSaving = true;

    const pagesToSave = this.pages.map(page => ({ name: page.name }));

    this.service.baixarZip(this.uploadId, pagesToSave).subscribe({
      next: (response) => {
        this.isSaving = false;
        const blob = response.body;
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;

          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'PDF_SEPARADOS.zip';
          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches?.[1]) filename = matches[1].replace(/['"]/g, '');
          }

          link.download = filename;
          link.click();
          window.URL.revokeObjectURL(url);

          this.messageService.add({
            severity: 'success',
            summary: 'Download iniciado',
            detail: 'Seu arquivo ZIP foi gerado com sucesso!',
            life: 4000
          });

          setTimeout(() => this.resetForm(), 1200);
        }
      },
      error: (error) => {
        this.isSaving = false;
        if (error.error instanceof Blob) {
          error.error.text().then((text: string) => this.showError(text || 'Erro ao salvar os PDFs'));
        } else {
          this.showError(error.error || 'Erro ao salvar os PDFs');
        }
      }
    });
  }

  getOriginalName(index: number): string {
    return this.pages[index]?.originalName ?? '';
  }

  restoreOriginalName(index: number): void {
    if (this.pages[index]) {
      this.pages[index].name = this.pages[index].originalName;
    }
  }

  resetForm(): void {
    this.selectedFile = null;
    this.uploadId = '';
    this.pages = [];
  }

  onClear(): void {
    this.resetForm();
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
  }
}
