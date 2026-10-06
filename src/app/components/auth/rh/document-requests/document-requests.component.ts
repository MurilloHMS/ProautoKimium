import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import * as XLSX from 'xlsx';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { RequestBuilderComponent } from './request-builder/request-builder.component';
import { RequestReviewComponent } from './request-review/request-review.component';
import { AudiencePickerComponent, audienceIsEmpty, emptyAudience } from './audience-picker/audience-picker.component';
import { DocumentRequestService } from '../../../../infrastructure/services/hr/document-request.service';
import { EmployeeDocumentService } from '../../../../infrastructure/services/hr/employee-document.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import { AudienceOptions } from '../../../../domain/models/events.model';
import { EmployeeDocumentType } from '../../../../domain/models/hr/employee-document.model';
import {
  Audience,
  DocumentRequest,
  RECIPIENT_STATUS_INFO,
  REQUEST_STATUS_INFO,
  Recipient,
  RecipientStatus,
  RequestField,
  answerText,
  answersSheet,
  tallyChoices,
} from '../../../../domain/models/hr/document-request.model';
import { formatDateBr } from '../../../../domain/utils/date-only';
import { apiMessage } from '../../../../domain/utils/api-error';

const SCREEN = 'rh/document-requests';

/**
 * Solicitações do RH: pedir arquivo ou resposta, acompanhar e conferir.
 *
 * Três momentos na mesma tela, como no mockup aprovado (2026-10-01): a lista,
 * o construtor (rascunho) e o acompanhamento de uma solicitação enviada, com os
 * contadores que filtram, a aba Totais para as escolhas (o uniforme) e o Excel.
 * A conferência de cada resposta é a mesma peça da Pendências.
 */
@Component({
  selector: 'app-document-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, Toast, InputTextModule, PkButtonComponent, PkDialogComponent, PkTableComponent, PkCanDirective,
    RequestBuilderComponent, RequestReviewComponent, AudiencePickerComponent,
  ],
  templateUrl: './document-requests.component.html',
  styleUrl: './document-requests.component.scss',
  providers: [MessageService],
})
export class DocumentRequestsComponent implements OnInit {
  private readonly service = inject(DocumentRequestService);
  private readonly documents = inject(EmployeeDocumentService);
  private readonly permissions = inject(PermissionStore);
  private readonly messages = inject(MessageService);

  readonly ehCelular = ehCelular();
  readonly requestStatus = REQUEST_STATUS_INFO;
  readonly recipientStatus = RECIPIENT_STATUS_INFO;
  readonly statusOrder: RecipientStatus[] = ['PENDING', 'SUBMITTED', 'RETURNED', 'APPROVED'];

  readonly loading = signal(false);
  readonly requests = signal<DocumentRequest[]>([]);
  readonly search = signal('');
  readonly docTypes = signal<EmployeeDocumentType[]>([]);
  readonly audienceOptions = signal<AudienceOptions | null>(null);

  /** O que a tela mostra: a lista, o construtor ou uma solicitação aberta. */
  readonly view = signal<'list' | 'builder' | 'detail'>('list');
  readonly editing = signal<DocumentRequest | null>(null);
  readonly opened = signal<DocumentRequest | null>(null);
  readonly recipients = signal<Recipient[]>([]);
  readonly recipientsLoading = signal(false);
  readonly filter = signal<RecipientStatus | null>(null);
  readonly tab = signal<'people' | 'totals'>('people');
  readonly reviewing = signal<Recipient | null>(null);

  readonly addingPeople = signal(false);
  readonly addAudience = signal<Audience>(emptyAudience());
  readonly confirmClose = signal(false);
  readonly busy = signal(false);

  readonly canDecide = computed(() => this.permissions.can(SCREEN, 'ALTERAR'));
  readonly canSend = computed(() => this.permissions.can(SCREEN, 'ENVIAR'));

  readonly visible = computed(() => {
    const q = fold(this.search().trim());
    return this.requests().filter(r => !q || fold(r.title).includes(q));
  });

  readonly visibleRecipients = computed(() => {
    const f = this.filter();
    const q = fold(this.search().trim());
    return this.recipients()
      .filter(r => !f || r.status === f)
      .filter(r => !q || fold(r.employeeName).includes(q));
  });

  /** As colunas de resposta na grade: as Escolhas (cabem numa célula). */
  readonly choiceFields = computed(() => (this.opened()?.form ?? []).filter(f => f.type === 'CHOICE'));
  readonly hasFiles = computed(() => (this.opened()?.form ?? []).some(f => f.type === 'FILE'));
  readonly totals = computed(() => tallyChoices(this.opened()?.form ?? [], this.recipients()));
  readonly toRemind = computed(() => {
    const c = this.opened()?.counts;
    return c ? c.pending + c.returned : 0;
  });

  ngOnInit(): void {
    this.load();
    this.documents.listTypes().subscribe({ next: t => this.docTypes.set(t), error: () => this.docTypes.set([]) });
    this.service.audienceOptions().subscribe({ next: o => this.audienceOptions.set(o), error: () => this.audienceOptions.set(null) });
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: list => {
        this.requests.set(list);
        this.loading.set(false);
        // A solicitação aberta acompanha a lista: os contadores mudam a cada decisão.
        const open = this.opened();
        if (open) this.opened.set(list.find(r => r.id === open.id) ?? open);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.fail(err, 'Não foi possível carregar as solicitações.');
      },
    });
  }

  // ── Navegação ──

  newRequest(): void {
    this.editing.set(null);
    this.view.set('builder');
  }

  open(r: DocumentRequest): void {
    if (r.status === 'DRAFT') {
      this.editing.set(r);
      this.view.set('builder');
      return;
    }
    this.opened.set(r);
    this.filter.set(null);
    this.tab.set('people');
    this.view.set('detail');
    this.loadRecipients();
  }

  backToList(): void {
    this.view.set('list');
    this.opened.set(null);
    this.editing.set(null);
    this.recipients.set([]);
  }

  builderSaved(r: DocumentRequest): void {
    this.messages.add({
      severity: 'success', summary: 'Pronto',
      detail: r.status === 'OPEN' ? `Enviada para ${r.counts.total} pessoa(s). Cada uma foi avisada.` : 'Rascunho salvo.',
    });
    this.load();
    if (r.status === 'OPEN') this.open(r);
    else this.editing.set(r);
  }

  // ── Acompanhamento ──

  loadRecipients(): void {
    const r = this.opened();
    if (!r) return;
    this.recipientsLoading.set(true);
    this.service.recipients(r.id).subscribe({
      next: list => {
        this.recipients.set(list);
        this.recipientsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.recipientsLoading.set(false);
        this.fail(err, 'Não foi possível carregar as respostas.');
      },
    });
  }

  toggleFilter(status: RecipientStatus): void {
    this.filter.set(this.filter() === status ? null : status);
    this.tab.set('people');
  }

  count(status: RecipientStatus): number {
    const c = this.opened()?.counts;
    if (!c) return 0;
    return status === 'PENDING' ? c.pending : status === 'SUBMITTED' ? c.submitted
      : status === 'RETURNED' ? c.returned : c.approved;
  }

  decided(updated: Recipient): void {
    this.reviewing.set(null);
    this.messages.add({
      severity: 'success', summary: 'Pronto',
      detail: updated.status === 'APPROVED' ? 'Resposta aprovada. A pessoa foi avisada.' : 'Resposta devolvida com o motivo.',
    });
    this.load();
    this.loadRecipients();
  }

  remind(): void {
    const r = this.opened();
    if (!r || this.busy()) return;
    this.busy.set(true);
    this.service.remind(r.id).subscribe({
      next: ({ reminded }) => {
        this.busy.set(false);
        this.messages.add({ severity: 'success', summary: 'Lembrete enviado', detail: `${reminded} pessoa(s) avisada(s) no sino.` });
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.fail(err, 'Não foi possível lembrar.'); },
    });
  }

  openAddPeople(): void {
    this.addAudience.set({ ...emptyAudience(), all: false });
    this.addingPeople.set(true);
  }

  addPeopleDisabled(): boolean {
    return audienceIsEmpty(this.addAudience()) || this.busy();
  }

  addPeople(): void {
    const r = this.opened();
    if (!r || this.addPeopleDisabled()) return;
    this.busy.set(true);
    const before = r.counts.total;
    this.service.addRecipients(r.id, this.addAudience()).subscribe({
      next: updated => {
        this.busy.set(false);
        this.addingPeople.set(false);
        this.opened.set(updated);
        this.messages.add({ severity: 'success', summary: 'Pronto', detail: `${updated.counts.total - before} pessoa(s) acrescentada(s).` });
        this.load();
        this.loadRecipients();
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.fail(err, 'Não foi possível acrescentar.'); },
    });
  }

  close(): void {
    const r = this.opened();
    if (!r || this.busy()) return;
    this.busy.set(true);
    this.service.close(r.id).subscribe({
      next: updated => {
        this.busy.set(false);
        this.confirmClose.set(false);
        this.opened.set(updated);
        this.messages.add({ severity: 'success', summary: 'Encerrada', detail: 'Ninguém mais responde; as respostas enviadas continuam conferíveis.' });
        this.load();
      },
      error: (err: HttpErrorResponse) => { this.busy.set(false); this.fail(err, 'Não foi possível encerrar.'); },
    });
  }

  duplicate(r: DocumentRequest, event?: Event): void {
    event?.stopPropagation();
    this.service.duplicate(r.id).subscribe({
      next: copy => {
        this.messages.add({ severity: 'success', summary: 'Duplicada', detail: 'Um rascunho novo com os mesmos campos.' });
        this.load();
        this.editing.set(copy);
        this.view.set('builder');
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'Não foi possível duplicar.'),
    });
  }

  removeDraft(r: DocumentRequest, event?: Event): void {
    event?.stopPropagation();
    if (!confirm(`Excluir o rascunho "${r.title}"?`)) return;
    this.service.remove(r.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Excluído', detail: 'Rascunho excluído.' });
        this.load();
      },
      error: (err: HttpErrorResponse) => this.fail(err, 'Não foi possível excluir.'),
    });
  }

  /** Uma linha por pessoa, uma coluna por campo: para a compra do uniforme, a conferência no papel. */
  exportExcel(): void {
    const r = this.opened();
    if (!r) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(answersSheet(r.form, this.recipients())), 'Respostas');
    for (const t of this.totals()) {
      const rows = t.counts.map(c => ({ Opção: c.option, Pessoas: c.n }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), t.field.label.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
    }
    XLSX.writeFile(wb, `${slug(r.title)}.xlsx`);
  }

  // ── Leitura ──

  progress(r: DocumentRequest): number {
    return r.counts.total ? Math.round((r.counts.approved / r.counts.total) * 100) : 0;
  }

  audienceText(r: DocumentRequest): string {
    return r.status === 'DRAFT' ? `${r.form.length} campo(s)` : `${r.counts.total} pessoa(s)`;
  }

  answer(r: Recipient, f: RequestField): string {
    return answerText(f, r.answers[f.key]);
  }

  fileCount(r: Recipient): string {
    return r.files.length ? `${r.files.length} arquivo(s)` : '—';
  }

  date(iso: string | null): string {
    return iso ? formatDateBr(iso) : '—';
  }

  barWidth(n: number, max: number): string {
    return `${max ? (n / max) * 100 : 0}%`;
  }

  maxOf(counts: { n: number }[]): number {
    return Math.max(1, ...counts.map(c => c.n));
  }

  private fail(err: HttpErrorResponse, fallback: string): void {
    this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? fallback });
  }
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function slug(text: string): string {
  return fold(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'solicitacao';
}
