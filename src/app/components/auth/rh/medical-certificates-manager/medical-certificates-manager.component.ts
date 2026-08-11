import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { MedicalCertificateService } from '../../../../infrastructure/services/hr/medical-certificate.service';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { formatDateBr } from '../../../../domain/utils/date-only';

@Component({
  selector: 'app-medical-certificates-manager',
  standalone: true,
  imports: [CommonModule, TableModule, Toast, PkButtonComponent, PkTableComponent, ButtonDirective, Tooltip, ToolbarComponent],
  templateUrl: './medical-certificates-manager.component.html',
  styleUrl: './medical-certificates-manager.component.scss',
  providers: [MessageService],
})
export class MedicalCertificatesManagerComponent implements OnInit {
  certificates: MedicalCertificate[] = [];
  loading = false;
  downloadingId: string | null = null;

  constructor(
    private certificateService: MedicalCertificateService,
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.certificateService.getAll().subscribe({
      next: (list) => {
        this.certificates = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  formatDate(iso: string): string {
    return formatDateBr(iso);
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  submissionLabel(type: string): string {
    return type === 'PHOTO' ? 'Foto' : 'Arquivo';
  }

  download(cert: MedicalCertificate): void {
    this.downloadingId = cert.id;
    this.certificateService.download(cert.id).subscribe({
      next: (resp) => {
        this.triggerDownload(resp.body!, cert.originalFilename);
        this.downloadingId = null;
      },
      error: () => {
        this.downloadingId = null;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: 'Falha ao baixar o atestado.' });
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 401: return 'Nao autorizado. Faca login novamente';
      case 403: return 'Voce nao tem permissao para esta acao';
      case 404: return 'Recurso nao encontrado';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexao com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
