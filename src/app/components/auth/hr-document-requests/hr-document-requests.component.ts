import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { FormScreenComponent } from '../shared/form-screen/form-screen.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { DocumentRequestService } from '../../../infrastructure/services/hr/document-request.service';
import {
  RECIPIENT_STATUS_INFO,
  Recipient,
  RequestField,
  RequestFile,
  answerText,
  canAnswer,
} from '../../../domain/models/hr/document-request.model';
import { formatDateBr } from '../../../domain/utils/date-only';
import { apiMessage } from '../../../domain/utils/api-error';

/**
 * As solicitações do RH para quem está logado: o que falta fazer em cima, o
 * já enviado embaixo. Abrir uma é responder: cada arquivo sobe na hora em que
 * é escolhido (foto de celular pesa, e a pessoa vê que chegou), e "Enviar"
 * manda as respostas e põe na fila do RH.
 */
@Component({
  selector: 'app-hr-document-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, Textarea, PkButtonComponent, FormScreenComponent, PageHeaderComponent],
  templateUrl: './hr-document-requests.component.html',
  styleUrl: './hr-document-requests.component.scss',
})
export class HrDocumentRequestsComponent implements OnInit {
  private readonly service = inject(DocumentRequestService);
  private readonly route = inject(ActivatedRoute);

  readonly statusInfo = RECIPIENT_STATUS_INFO;

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly items = signal<Recipient[]>([]);

  /** Devolvida primeiro: é a que tem motivo para ler e algo a corrigir. */
  readonly todo = computed(() => this.items().filter(canAnswer)
    .sort((a, b) => Number(b.status === 'RETURNED') - Number(a.status === 'RETURNED')));
  readonly done = computed(() => this.items().filter(r => !canAnswer(r)));

  readonly current = signal<Recipient | null>(null);
  readonly editable = computed(() => !!this.current() && canAnswer(this.current()!));
  answers: Record<string, unknown> = {};
  readonly files = signal<Record<string, RequestFile>>({});
  readonly uploading = signal<string | null>(null);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal<string | null>(null);

  readonly missing = computed(() => {
    const r = this.current();
    if (!r) return [];
    // `files()` entra aqui para o botão reagir ao upload; as respostas de texto
    // são conferidas de novo no clique, que é quando valem.
    const uploaded = this.files();
    return r.form.filter(f => f.required && f.type === 'FILE' && !uploaded[f.key]).map(f => f.label);
  });

  ngOnInit(): void {
    this.load(this.route.snapshot.queryParamMap.get('resposta'));
  }

  load(openId: string | null = null): void {
    this.loading.set(true);
    this.service.mine().subscribe({
      next: list => {
        this.items.set(list);
        this.loading.set(false);
        this.loadError.set(false);
        // A Home e o sino abrem direto a solicitação: `?resposta=<id>`.
        const target = openId ? list.find(r => r.id === openId) : null;
        if (target) this.open(target);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  open(r: Recipient): void {
    this.current.set(r);
    this.answers = { ...r.answers };
    this.files.set(Object.fromEntries(r.files.map(f => [f.fieldKey, f])));
    this.error.set(null);
    this.sent.set(null);
  }

  closeForm(): void {
    this.current.set(null);
  }

  pick(field: RequestField, value: unknown): void {
    if (!this.editable()) return;
    this.answers = { ...this.answers, [field.key]: value };
  }

  isPicked(field: RequestField, value: unknown): boolean {
    return this.answers[field.key] === value;
  }

  /** Sobe na hora: a pessoa vê o arquivo chegar antes de apertar "Enviar". */
  onFile(field: RequestField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const r = this.current();
    if (!file || !r) return;
    this.uploading.set(field.key);
    this.error.set(null);
    this.service.uploadFile(r.id, field.key, file).subscribe({
      next: saved => {
        this.uploading.set(null);
        this.files.set({ ...this.files(), [field.key]: saved });
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(null);
        this.error.set(apiMessage(err) ?? 'Não foi possível enviar o arquivo.');
      },
    });
  }

  downloadTemplate(): void {
    const r = this.current();
    if (!r) return;
    this.service.downloadTemplate(r.requestId).subscribe({
      next: resp => resp.body && saveBlob(resp.body, r.requestTemplateFilename ?? 'modelo'),
      error: (err: HttpErrorResponse) => this.error.set(apiMessage(err) ?? 'Não foi possível baixar o modelo.'),
    });
  }

  downloadMine(file: RequestFile): void {
    this.service.downloadFile(file.id).subscribe({
      next: resp => resp.body && saveBlob(resp.body, file.originalFilename),
      error: (err: HttpErrorResponse) => this.error.set(apiMessage(err) ?? 'Não foi possível baixar o arquivo.'),
    });
  }

  submit(): void {
    const r = this.current();
    if (!r || this.sending() || this.missing().length) return;
    const empty = r.form.find(f => f.required && f.type !== 'FILE' && isBlank(this.answers[f.key]));
    if (empty) {
      this.error.set(`Preencha "${empty.label}".`);
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    this.service.submit(r.id, this.answers).subscribe({
      next: () => {
        this.sending.set(false);
        this.current.set(null);
        this.sent.set(`"${r.requestTitle}" foi para o RH. Você recebe um aviso quando aprovarem, ou se precisar mandar de novo.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.error.set(apiMessage(err) ?? 'Não foi possível enviar.');
      },
    });
  }

  answer(field: RequestField): string {
    return answerText(field, this.answers[field.key]);
  }

  date(iso: string | null): string {
    return iso ? formatDateBr(iso) : '';
  }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim());
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
