import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { NfeService } from '../../../../infrastructure/services/nfe/nfe.service';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';

type Mode = 'nfe' | 'icms' | 'rename';

interface ModeOption {
  key: Mode;
  label: string;
  description: string;
  icon: string;
  accent: string;
  fileType: string;
  outputLabel: string;
}

@Component({
  selector: 'app-nfe-data-collector',
  standalone: true,
  imports: [CommonModule, FormsModule, Toast, PkButtonComponent],
  templateUrl: './nfe-data-collector.component.html',
  styleUrl: './nfe-data-collector.component.scss',
  providers: [MessageService],
})
export class NfeDataCollectorComponent {
  selectedMode = signal<Mode | null>(null);
  files = signal<File[]>([]);
  processing = signal(false);

  modes: ModeOption[] = [
    {
      key: 'nfe',
      label: 'Dados da NFe',
      description: 'Extrai dados dos produtos a partir de XMLs de NFe',
      icon: 'pi pi-file-export',
      accent: '#3e9e8e',
      fileType: '.xml',
      outputLabel: 'Excel',
    },
    {
      key: 'icms',
      label: 'Dados do ICMS',
      description: 'Extrai valores de ICMS, PIS e COFINS dos XMLs',
      icon: 'pi pi-calculator',
      accent: '#7c5cbf',
      fileType: '.xml',
      outputLabel: 'Excel',
    },
    {
      key: 'rename',
      label: 'Renomear NFS-e',
      description: 'Renomeia PDFs de NFS-e com número e fornecedor',
      icon: 'pi pi-pencil',
      accent: '#e07b4c',
      fileType: '.pdf',
      outputLabel: 'ZIP',
    },
  ];

  constructor(
    private messageService: MessageService,
    private nfeService: NfeService,
  ) {}

  get activeMode(): ModeOption | null {
    const key = this.selectedMode();
    return key ? this.modes.find(m => m.key === key) ?? null : null;
  }

  selectMode(mode: Mode): void {
    this.selectedMode.set(mode);
    this.files.set([]);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.files.set([...this.files(), ...Array.from(input.files)]);
    }
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      this.files.update(current => [...current, ...Array.from(event.dataTransfer!.files)]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  removeFile(index: number): void {
    this.files.update(current => current.filter((_, i) => i !== index));
  }

  clearFiles(): void {
    this.files.set([]);
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  processFiles(): void {
    const mode = this.selectedMode();
    const fileList = this.files();

    if (!mode) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Selecione uma ferramenta' });
      return;
    }
    if (!fileList.length) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Nenhum arquivo selecionado' });
      return;
    }

    this.processing.set(true);

    if (mode === 'rename') {
      this.nfeService.renameNfseFiles(fileList).subscribe({
        next: blob => this.downloadBlob(blob, 'nfse_renomeadas.zip', 'ZIP gerado com sucesso!'),
        error: () => this.onError(),
      });
    } else {
      this.nfeService.processXmlFiles(fileList, mode).subscribe({
        next: blob => {
          const filename = mode === 'nfe' ? 'nfe_data.xlsx' : 'icms_data.xlsx';
          this.downloadBlob(blob, filename, 'Excel gerado com sucesso!');
        },
        error: () => this.onError(),
      });
    }
  }

  private downloadBlob(blob: Blob, filename: string, successMsg: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.processing.set(false);
    this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: successMsg });
  }

  private onError(): void {
    this.processing.set(false);
    this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Ocorreu um erro ao processar os arquivos.' });
  }
}
