import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { MedicalCertificateService } from '../../../../infrastructure/services/hr/medical-certificate.service';
import {
  MEDICAL_CERTIFICATE_STATUS_INFO,
  MedicalCertificate,
  MedicalCertificateAttempt,
  MedicalCertificateStatus,
} from '../../../../domain/models/hr/medical-certificate.model';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { formatDateBr, formatStampBr } from '../../../../domain/utils/date-only';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';

type ReviewAction = 'receive' | 'reject';

interface StatusChip {
  label: string;
  value: MedicalCertificateStatus | null;
  icon: string;
  tone: 'acao' | 'success' | 'danger' | 'neutral';
  dashed?: boolean;
}

/**
 * Atestados do RH: a conferência (2026-10-02). O RH confirma o recebimento ou
 * recusa com o motivo; quem enviou é avisado e, recusado, manda outro arquivo.
 * O mesmo desenho dos Reembolsos: chips de status, e a janela de revisão que
 * no celular sobe de baixo.
 */
@Component({
  selector: 'app-medical-certificates-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, Toast, PkButtonComponent, PkTableComponent, PkDialogComponent,
    PkSheetComponent, ButtonDirective, Tooltip, ToolbarComponent, PkCanDirective,
  ],
  templateUrl: './medical-certificates-manager.component.html',
  styleUrl: './medical-certificates-manager.component.scss',
  providers: [MessageService],
})
export class MedicalCertificatesManagerComponent implements OnInit {
  certificates: MedicalCertificate[] = [];
  loading = false;
  downloadingId: string | null = null;

  readonly ehCelular = ehCelular();
  readonly statusInfo = MEDICAL_CERTIFICATE_STATUS_INFO;

  /** "Em conferência" é o único que pede o RH, e por isso abre ligado. */
  readonly statusChips: StatusChip[] = [
    { label: 'Em conferência', value: 'PENDING', icon: 'pi pi-clock', tone: 'acao' },
    { label: 'Recebidos', value: 'RECEIVED', icon: 'pi pi-check', tone: 'success' },
    { label: 'Recusados', value: 'REJECTED', icon: 'pi pi-times', tone: 'danger', dashed: true },
    { label: 'Todos', value: null, icon: 'pi pi-list', tone: 'neutral' },
  ];
  statusFilter: MedicalCertificateStatus | null = 'PENDING';
  /** Quantos em conferência: a contagem que importa, carregada à parte do filtro. */
  pendingCount: number | null = null;

  // Sinais: a janela é sempre montada (escondida), e com campo comum o título
  // mudava no meio de uma verificação — o NG0100 que o teste pegou.
  readonly reviewVisible = signal(false);
  readonly reviewAction = signal<ReviewAction>('receive');
  readonly reviewTarget = signal<MedicalCertificate | null>(null);
  reviewNotes = '';
  readonly reviewSaving = signal(false);

  constructor(
    private certificateService: MedicalCertificateService,
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.certificateService.getAll(this.statusFilter).subscribe({
      next: (list) => {
        this.certificates = list;
        this.loading = false;
        if (this.statusFilter === 'PENDING') this.pendingCount = list.length;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
    if (this.statusFilter !== 'PENDING') {
      this.certificateService.getAll('PENDING').subscribe({
        next: (list) => (this.pendingCount = list.length),
        error: () => (this.pendingCount = null),
      });
    }
  }

  filterByStatus(status: MedicalCertificateStatus | null): void {
    if (status === this.statusFilter) return;
    this.statusFilter = status;
    this.load();
  }

  formatDate(iso: string): string {
    return formatDateBr(iso);
  }

  formatStamp(iso: string | null): string {
    return iso ? formatStampBr(iso) : '';
  }

  submissionLabel(type: string): string {
    return type === 'PHOTO' ? 'Foto' : 'Arquivo';
  }

  /** As linhas do pk-table chegam como `any`: o índice passa por aqui, tipado. */
  statusLabel(c: MedicalCertificate): string {
    return this.statusInfo[c.status].label;
  }

  statusIcon(c: MedicalCertificate): string {
    return this.statusInfo[c.status].icon;
  }

  /** Quando chegou o arquivo que está em vigor. */
  lastSubmittedAt(c: MedicalCertificate): string {
    return c.resubmittedAt ?? c.submittedAt;
  }

  /** A recusa mais recente da trilha — o que o RH disse antes deste arquivo. */
  lastRejection(c: MedicalCertificate): MedicalCertificateAttempt | null {
    return c.previousAttempts.length ? c.previousAttempts[c.previousAttempts.length - 1] : null;
  }

  // ---- Confirmar / Recusar ----

  openReview(c: MedicalCertificate, action: ReviewAction): void {
    this.reviewTarget.set(c);
    this.reviewAction.set(action);
    this.reviewNotes = '';
    this.reviewVisible.set(true);
  }

  get canConfirmReview(): boolean {
    return this.reviewAction() === 'receive' || this.reviewNotes.trim().length > 0;
  }

  confirmReview(): void {
    const target = this.reviewTarget();
    if (!target || !this.canConfirmReview) return;
    this.reviewSaving.set(true);
    const action = this.reviewAction();
    const notes = this.reviewNotes.trim();
    const call = action === 'receive'
      ? this.certificateService.confirmReceipt(target.id, notes || null)
      : this.certificateService.reject(target.id, notes);

    call.subscribe({
      next: () => {
        this.reviewSaving.set(false);
        this.reviewVisible.set(false);
        this.load();
        this.msgService.add({
          severity: 'success',
          summary: 'Pronto',
          detail: action === 'receive'
            ? 'Recebimento confirmado. Quem enviou foi avisado.'
            : 'Atestado recusado. Quem enviou foi avisado e pode mandar outro arquivo.',
        });
      },
      error: (err) => {
        this.reviewSaving.set(false);
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  // ---- Arquivos ----

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

  downloadAttempt(cert: MedicalCertificate, attempt: MedicalCertificateAttempt): void {
    this.certificateService.downloadAttempt(cert.id, attempt.id).subscribe({
      next: (resp) => this.triggerDownload(resp.body!, attempt.originalFilename),
      error: () => this.msgService.add({ severity: 'warning', summary: 'Erro', detail: 'Falha ao baixar o arquivo anterior.' }),
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
      case 400: return err.error?.message ?? 'Dados inválidos';
      case 403: return err.error?.message ?? 'Você não tem permissão para esta ação';
      case 409: return err.error?.message ?? 'Conflito ao processar a solicitação';
      case 404: return 'Atestado não encontrado';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
