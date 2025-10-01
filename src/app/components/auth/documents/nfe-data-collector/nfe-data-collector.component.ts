import { NfeService } from './../../../../infrastructure/services/nfe/nfe.service';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { MessageService } from 'primeng/api';
import { FileUpload } from 'primeng/fileupload';
import { Button } from 'primeng/button';
import { Badge } from 'primeng/badge';
import { ProgressBar } from 'primeng/progressbar';
import { Toast } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-nfe-data-collector',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FileUpload,
    Button,
    Badge,
    ProgressBar,
    Toast,
    ToggleSwitchModule,
    FormsModule
  ],
  templateUrl: './nfe-data-collector.component.html',
  styleUrls: ['./nfe-data-collector.component.scss'],
  providers: [MessageService]
})
export class NfeDataCollectorComponent {
  files: any[] = [];
  totalSize: number = 0;
  totalSizePercent: number = 0;
  index: number = 0;
  collectNfe = false;
  collectIcms = false;

  constructor(
    private messageService: MessageService,
    private nfeService: NfeService
  ) {}

  choose(event: any, callback: () => void) {
    callback();
  }


  onToggle(type: 'nfe' | 'icms') {
    if (type === 'nfe') {
      this.collectIcms = false;
    } else {
      this.collectNfe = false;
    }
  }


  onRemoveTemplatingFile(event: any, file: any, removeFileCallback: any, index: number) {
    removeFileCallback(event, index);
    this.totalSize -= file.size;
    this.totalSizePercent = this.totalSize / 10;
  }

  onClearTemplatingUpload(clear: () => void) {
    clear();
    this.totalSize = 0;
    this.totalSizePercent = 0;
  }

  onSelectedFiles(event: any) {
    this.files = event.currentFiles;
    this.totalSize = this.files.reduce((acc, file) => acc + file.size, 0);
    this.totalSizePercent = Math.min((this.totalSize / 1000000) * 10, 100)
  }

  uploadFiles() {
    if(this.collectIcms === false && this.collectNfe === false) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Selecione uma opção de coleta (NFE ou ICMS)' });
      return;
    }

    if (!this.files.length) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Nenhum arquivo selecionado' });
      return;
    }

    const fileList: File[] = this.files.map(f => f as File);

    const selectedOption = this.collectNfe ? 'nfe' : 'icms';

    this.nfeService.processXmlFiles(fileList, selectedOption).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedOption === 'nfe' ? 'nfe_data' : 'icms_data'}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Excel gerado com sucesso!'
        });
      },
      error: err => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Ocorreu um erro ao processar os arquivos.'
        });
        console.error('Error processing files:', err);
      }
    });
  }

  uploadEvent(callback: () => void) {
    callback();
  }

  formatSize(bytes: number) {
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB'];

    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
  }
}
