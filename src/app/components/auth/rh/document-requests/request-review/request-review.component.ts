import { Component, OnDestroy, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { DocumentRequestService } from '../../../../../infrastructure/services/hr/document-request.service';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import {
  RECIPIENT_STATUS_INFO,
  Recipient,
  RequestField,
  RequestFile,
  answerText,
} from '../../../../../domain/models/hr/document-request.model';
import { formatStampBr } from '../../../../../domain/utils/date-only';
import { apiMessage } from '../../../../../domain/utils/api-error';
import { isPdfReceipt } from '../../pending-queue/pending-queue.logic';

/**
 * A conferência de uma resposta: o arquivo aberto na tela, as respostas ao
 * lado, e aprovar ou devolver com motivo.
 *
 * Uma peça só para dois lugares — a aba Solicitações da Pendências e o
 * acompanhamento de uma solicitação —, para a conferência não ter duas versões.
 * No celular sobe de baixo; no computador é diálogo.
 */
@Component({
  selector: 'app-request-review',
  standalone: true,
  imports: [CommonModule, FormsModule, PkButtonComponent, PkDialogComponent, PkSheetComponent],
  templateUrl: './request-review.component.html',
  styleUrl: './request-review.component.scss',
})
export class RequestReviewComponent implements OnDestroy {
  private readonly service = inject(DocumentRequestService);
  private readonly sanitizer = inject(DomSanitizer);

  /** A resposta aberta; null fecha. */
  readonly recipient = input<Recipient | null>(null);
  /** Só quem pode ALTERAR na tela do RH aprova e devolve; os outros só olham. */
  readonly canDecide = input(false);

  readonly closed = output<void>();
  /** Depois de aprovar ou devolver: a tela dona recarrega a lista. */
  readonly decided = output<Recipient>();

  readonly ehCelular = ehCelular();
  readonly statusInfo = RECIPIENT_STATUS_INFO;

  readonly fileFields = computed(() => (this.recipient()?.form ?? []).filter(f => f.type === 'FILE'));
  readonly answerFields = computed(() => (this.recipient()?.form ?? []).filter(f => f.type !== 'FILE'));
  readonly files = computed(() => this.recipient()?.files ?? []);
  readonly decidable = computed(() => this.canDecide() && this.recipient()?.status === 'SUBMITTED');

  readonly shown = signal<RequestFile | null>(null);
  readonly preview = signal<{ url: SafeResourceUrl; raw: string; isPdf: boolean } | null>(null);
  readonly previewError = signal(false);

  reason = '';
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Abrir outra resposta limpa o motivo e mostra o primeiro arquivo dela.
    // Só a resposta é vigiada: o `show` lê o `preview`, e sem o `untracked` o
    // fim do download disparava este efeito de novo — baixava o arquivo em ciclo.
    effect(() => {
      const r = this.recipient();
      untracked(() => {
        this.reason = '';
        this.error.set(null);
        this.show(r?.files[0] ?? null);
      });
    });
  }

  ngOnDestroy(): void {
    this.release();
  }

  fieldOf(file: RequestFile): string {
    return this.fileFields().find(f => f.key === file.fieldKey)?.label ?? file.fieldKey;
  }

  answer(field: RequestField): string {
    return answerText(field, this.recipient()?.answers[field.key]);
  }

  stamp(iso: string | null): string {
    return iso ? formatStampBr(iso) : '';
  }

  title(): string {
    const r = this.recipient();
    return r ? `${r.employeeName} · ${r.requestTitle}` : '';
  }

  show(file: RequestFile | null): void {
    this.release();
    this.shown.set(file);
    if (!file) return;
    this.service.downloadFile(file.id).subscribe({
      next: resp => {
        if (this.shown()?.id !== file.id || !resp.body) return;
        const raw = URL.createObjectURL(resp.body);
        const isPdf = isPdfReceipt(resp.body.type, file.originalFilename);
        this.preview.set({ raw, isPdf, url: this.sanitizer.bypassSecurityTrustResourceUrl(raw) });
      },
      error: () => this.previewError.set(true),
    });
  }

  download(file: RequestFile): void {
    this.service.downloadFile(file.id).subscribe({
      next: resp => resp.body && saveBlob(resp.body, file.originalFilename),
      error: (err: HttpErrorResponse) => this.error.set(apiMessage(err) ?? 'Não foi possível baixar o arquivo.'),
    });
  }

  /** Devolver exige o motivo: é o que a pessoa lê para corrigir. */
  get canReturn(): boolean {
    return this.reason.trim().length > 0;
  }

  decide(action: 'approve' | 'return'): void {
    const r = this.recipient();
    if (!r || this.saving() || !this.decidable()) return;
    if (action === 'return' && !this.canReturn) return;
    this.saving.set(true);
    this.error.set(null);
    const call = action === 'approve' ? this.service.approve(r.id) : this.service.giveBack(r.id, this.reason.trim());
    call.subscribe({
      next: updated => {
        this.saving.set(false);
        this.decided.emit(updated);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(apiMessage(err) ?? 'Não foi possível registrar a decisão.');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  private release(): void {
    const p = this.preview();
    if (p) URL.revokeObjectURL(p.raw);
    this.preview.set(null);
    this.previewError.set(false);
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
