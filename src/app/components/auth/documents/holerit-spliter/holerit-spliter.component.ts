import { Component } from '@angular/core';
import { ToastModule } from "primeng/toast";
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../../environments/environment';

interface PdfPageInfoDTO  {
  name: string;
}

interface UploadResponse  {
  uploadId: string;
  pages: PdfPageInfoDTO [];
}

@Component({
    selector: 'app-holerit-spliter',
    imports: [
    CommonModule,
    FormsModule,
    FileUploadModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ProgressSpinnerModule,
    ToastModule
  ],
    templateUrl: './holerit-spliter.component.html',
    styleUrl: './holerit-spliter.component.scss',
    providers: [MessageService]
})
export class HoleritSpliterComponent {
  selectedFile: File | null = null;
  uploadId: string = '';
  pages: PdfPageInfoDTO [] = [];
  isUploading: boolean = false;
  isSaving: boolean = false;
  uploadError: string = '';

  constructor(
    private http: HttpClient,
    private messageService: MessageService
  ) {}

  onFileSelect(event: any): void {
    const file = event.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadError = '';
      this.uploadPdf();
    }
  }

  uploadPdf(): void {
    if (!this.selectedFile) {
      this.messageService.add({severity:'error', summary: 'Error', detail: 'Nenhum arquivo selecionado'});
      return;
    }

    this.isUploading = true;
    this.uploadError = '';
    this.pages = [];
    this.uploadId = '';

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<UploadResponse>(`${environment.apiUrl}/pdf/upload`, formData)
      .subscribe({
        next: (response) => {
          this.uploadId = response.uploadId;
          this.pages = response.pages.map(page => ({
            name: page.name,
            originalName: page.name
          }));
          this.isUploading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: `PDF enviado com sucesso! ${this.pages.length} página(s) extraída(s).`
          });
        },
        error: (error) => {
          this.isUploading = false;
          const errorMsg = error.error || 'Erro ao enviar o arquivo';
          this.messageService.add({
            severity: 'error',
            summary: 'Falha no Upload',
            detail: errorMsg
          });
        }
      });
  }
  saveRenamedPages(): void {
    if (!this.uploadId || this.pages.length === 0) {
      this.messageService.add({severity:'error', summary: 'Error', detail: 'Nenhum arquivo para salvar'});
      return;
    }

    this.isSaving = true;

    const pagesToSave = this.pages.map(page => ({ name: page.name }));

    this.http.post(`${environment.apiUrl}/pdf/save/${this.uploadId}`, pagesToSave, {
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
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
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }

          link.download = filename;
          link.click();
          window.URL.revokeObjectURL(url);

          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: 'PDFs salvos e baixados com sucesso!'
          });

          setTimeout(() => this.resetForm(), 1000);
        }
      },
      error: (error) => {
        this.isSaving = false;

        if (error.error instanceof Blob) {
          error.error.text().then((text: string) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Falha ao Salvar',
              detail: text || 'Erro ao salvar os PDFs'
            });
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Falha ao Salvar',
            detail: error.error || 'Erro ao salvar os PDFs'
          });
        }
      }
    });
  }

  resetForm(): void {
    this.selectedFile = null;
    this.uploadId = '';
    this.pages = [];
  }

  onClear(): void {
    this.resetForm();
  }
}
