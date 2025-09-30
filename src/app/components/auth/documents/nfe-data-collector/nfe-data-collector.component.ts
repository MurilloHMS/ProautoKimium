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
  checked: boolean = false;

  constructor(
    private messageService: MessageService
  ) {}

  choose(event: any, callback: () => void) {
    callback();
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

  onTemplatedUpload() {
    this.messageService.add({
      severity: 'info',
      summary: 'Success',
      detail: 'File Uploaded',
      life: 3000
    });
  }

  onSelectedFiles(event: any) {
    this.files = event.currentFiles;
    this.files.forEach(file => {
      this.totalSize += file.size;
    });
    this.totalSizePercent = this.totalSize / 10;
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
