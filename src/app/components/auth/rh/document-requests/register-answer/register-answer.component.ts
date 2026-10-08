import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { DocumentRequestService } from '../../../../../infrastructure/services/hr/document-request.service';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import { Recipient, RequestField, RequestFile } from '../../../../../domain/models/hr/document-request.model';
import { apiMessage } from '../../../../../domain/utils/api-error';

/**
 * O RH registra a resposta no lugar do funcionário (mockup aprovado em
 * 2026-10-08): quem não tem acesso ao portal, ou entregou o documento em papel.
 *
 * O mesmo formulário que o funcionário vê, com o aviso de que é o RH
 * respondendo. "Registrar" manda para a conferência; "Registrar e aprovar"
 * conclui na hora, porque o RH já conferiu o papel na mão. O arquivo sobe na
 * hora, como no portal, para a pessoa ver que chegou antes de registrar.
 */
@Component({
  selector: 'app-register-answer',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, InputTextModule, Textarea, PkButtonComponent, PkDialogComponent, PkSheetComponent],
  templateUrl: './register-answer.component.html',
  styleUrl: './register-answer.component.scss',
})
export class RegisterAnswerComponent {
  private readonly service = inject(DocumentRequestService);

  /** De quem é a resposta; null fecha a folha. */
  readonly recipient = input<Recipient | null>(null);
  readonly closed = output<void>();
  /** Registrou (com ou sem aprovar): a tela dona recarrega a lista. */
  readonly registered = output<Recipient>();

  readonly ehCelular = ehCelular();
  readonly answers = signal<Record<string, unknown>>({});
  readonly files = signal<Record<string, RequestFile>>({});
  readonly uploading = signal<string | null>(null);
  readonly saving = signal<'register' | 'approve' | null>(null);
  readonly error = signal<string | null>(null);

  readonly title = computed(() => `Registrar resposta de ${this.recipient()?.employeeName ?? ''}`);
  readonly firstName = computed(() => (this.recipient()?.employeeName ?? '').split(' ')[0]);

  /** O que falta, na ordem do formulário: obrigatórios sem arquivo ou sem resposta. */
  readonly missing = computed(() => {
    const r = this.recipient();
    if (!r) return [];
    const up = this.files(), a = this.answers();
    return r.form.filter(f => f.required && (f.type === 'FILE' ? !up[f.key] : isBlank(a[f.key]))).map(f => f.label);
  });

  constructor() {
    // Cada pessoa aberta começa do que já existe (a resposta devolvida, os arquivos que já subiram).
    effect(() => {
      const r = this.recipient();
      this.answers.set(r ? { ...r.answers } : {});
      this.files.set(r ? Object.fromEntries(r.files.map(f => [f.fieldKey, f])) : {});
      this.error.set(null);
    });
  }

  pick(field: RequestField, value: unknown): void {
    this.answers.set({ ...this.answers(), [field.key]: value });
  }

  isPicked(field: RequestField, value: unknown): boolean {
    return this.answers()[field.key] === value;
  }

  onFile(field: RequestField, event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    const r = this.recipient();
    if (!file || !r) return;
    this.uploading.set(field.key);
    this.error.set(null);
    this.service.uploadOnBehalf(r.id, field.key, file).subscribe({
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

  save(approve: boolean): void {
    const r = this.recipient();
    if (!r || this.saving() || this.uploading()) return;
    if (this.missing().length) {
      this.error.set(`Falta: ${this.missing().join(', ')}.`);
      return;
    }
    this.saving.set(approve ? 'approve' : 'register');
    this.error.set(null);
    this.service.registerOnBehalf(r.id, this.answers(), approve).subscribe({
      next: saved => {
        this.saving.set(null);
        this.registered.emit(saved);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(null);
        this.error.set(apiMessage(err) ?? 'Não foi possível registrar a resposta.');
      },
    });
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim());
}
