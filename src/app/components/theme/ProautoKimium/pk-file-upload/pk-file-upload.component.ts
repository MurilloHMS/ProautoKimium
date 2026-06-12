import {Component, computed, input, output, viewChild} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FileSelectEvent, FileUpload, FileUploadModule} from "primeng/fileupload";
import {PkButtonComponent, PkButtonType} from "../pk-button/pk-button.component";
import {ProgressSpinnerModule} from "primeng/progressspinner";

export type PkUploadMode = 'button' | 'dropzone' | 'both';

@Component({
  selector: 'pk-fileUpload',
  imports: [
    CommonModule,
    FileUploadModule,
    PkButtonComponent,
    ProgressSpinnerModule
  ],
  templateUrl: './pk-file-upload.component.html',
  styleUrl: './pk-file-upload.component.scss',
})
export class PkFileUploadComponent {
  mode = input<PkUploadMode>('button');
  accept = input<string>('');
  maxFileSize = input<number>(10_000_000);
  multiple = input<boolean>(false);
  loading = input<boolean>(false);
  loadingTitle = input<string>('Processando...');
  loadingSubtitle = input<string>('Aguarde um momento');

  // ── Labels / textos ─────────────────────────────────────
  chooseLabel = input<string>('Selecionar Arquivo');
  chooseType = input<PkButtonType>('upload');
  dropTitle = input<string>('Arraste e solte o arquivo aqui');
  dropHint = input<string>('');
  fileIcon = input<string>('pi pi-file');

  // ── Estado ───────────────────────────────────────────────
  files: File[] = [];

  // ── Outputs ──────────────────────────────────────────────
  filesSelected = output<File[]>();
  fileRemoved   = output<File>();
  cleared       = output<void>();

  isDropzone = computed(() => this.mode() === 'dropzone' || this.mode() === 'both');
  showChooseButton = computed(() => this.mode() === 'button' || this.mode() === 'both');

  resolvedHint = computed(() => {
    if (this.dropHint()) return this.dropHint();
    const max = (this.maxFileSize() / (1024 * 1024)).toFixed(0);
    return `ou clique em ${this.chooseLabel()} · Máx. ${max} MB`;
  });

  onSelect(event: FileSelectEvent): void {
    if (!event.files || event.files.length === 0) return;

    if (this.multiple()) {
      this.files = [...this.files, ...event.files];
    } else {
      this.files = [event.files[0]];
    }
    this.filesSelected.emit(this.files);
  }

  onRemove(file: File, index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
    this.fileRemoved.emit(file);
    if (this.files.length === 0) this.cleared.emit();
  }

  clearAll(): void {
    this.files = [];
    this.cleared.emit();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  fileUploadRef = viewChild<FileUpload>('fu');

  triggerUpload(): void {
    const fu = this.fileUploadRef();
    if (fu) {
      (fu as any).basicFileInput?.nativeElement?.click();
    }
  }
}
