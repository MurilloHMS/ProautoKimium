import { Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, switchMap, tap } from 'rxjs';

import { FormScreenComponent } from '../../../shared/form-screen/form-screen.component';
import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { AudiencePickerComponent, audienceIsEmpty, emptyAudience } from '../audience-picker/audience-picker.component';
import { DocumentRequestService } from '../../../../../infrastructure/services/hr/document-request.service';
import { AudienceOptions } from '../../../../../domain/models/events.model';
import { EmployeeDocumentType } from '../../../../../domain/models/hr/employee-document.model';
import {
  Audience,
  DocumentRequest,
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  FieldType,
  RequestField,
  formProblems,
  newField,
} from '../../../../../domain/models/hr/document-request.model';
import { apiMessage } from '../../../../../domain/utils/api-error';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import { formatDateOnly, parseDateOnly } from '../../../../../domain/utils/date-only';

/**
 * Criar e editar o rascunho de uma solicitação (mockup aprovado em 2026-10-01).
 *
 * Três colunas que rolam sozinhas (replanejado em 2026-10-08): sobre a
 * solicitação e quem recebe, os campos, e a prévia do funcionário. Antes era
 * uma coluna só, e com oito campos o rodapé com Salvar e Enviar ficava cortado.
 * Só o campo selecionado fica aberto; o erro de um campo só aparece depois que
 * a pessoa sai dele ou tenta enviar. O rascunho só nasce na API na primeira
 * gravação: "Nova solicitação" sem salvar não deixa lixo.
 */
@Component({
  selector: 'app-request-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, DatePickerModule, SelectModule, Textarea, FormScreenComponent, PkButtonComponent, AudiencePickerComponent],
  templateUrl: './request-builder.component.html',
  styleUrl: './request-builder.component.scss',
})
export class RequestBuilderComponent implements OnInit {
  private readonly service = inject(DocumentRequestService);

  /** O rascunho sendo editado; null para um novo. */
  readonly request = input<DocumentRequest | null>(null);
  readonly docTypes = input<EmployeeDocumentType[]>([]);
  readonly audienceOptions = input<AudienceOptions | null>(null);

  readonly back = output<void>();
  /** Gravou (rascunho ou envio): a tela dona recarrega a lista. */
  readonly saved = output<DocumentRequest>();

  readonly types = FIELD_TYPES;
  readonly typeLabel = FIELD_TYPE_LABEL;

  readonly id = signal<string | null>(null);
  readonly title = signal('');
  readonly instructions = signal('');
  readonly dueDate = signal<string | null>(null);
  readonly fields = signal<RequestField[]>([]);
  readonly templateFilename = signal<string | null>(null);
  readonly audience = signal<Audience>(emptyAudience());

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly ehCelular = ehCelular();
  /** No celular as três colunas viram abas; começa nos campos, que é o trabalho. */
  readonly mobileTab = signal<'about' | 'fields' | 'preview'>('fields');
  /** O campo aberto; os outros são uma linha. */
  readonly selectedKey = signal<string | null>(null);
  /** Campos de onde a pessoa já saiu: só neles o erro aparece. */
  readonly touched = signal<ReadonlySet<string>>(new Set());
  /** Tentou enviar com algo faltando: aí todos os erros aparecem. */
  readonly attempted = signal(false);

  /** O que impede o envio, na ordem em que a pessoa resolveria. */
  readonly sendProblems = computed(() => [
    ...this.problems(),
    ...(audienceIsEmpty(this.audience()) ? ['Escolha quem recebe.'] : []),
  ]);

  readonly problems = computed(() => formProblems(this.title(), this.fields()));
  readonly canSend = computed(() => this.problems().length === 0 && !audienceIsEmpty(this.audience()));
  /** As opções do combo "vira documento", com a de não guardar primeiro. */
  readonly typeOptions = computed(() => [
    { label: 'Não guardar em Documentos', value: null as string | null },
    ...this.docTypes().filter(t => t.active).map(t => ({ label: t.name, value: t.id as string | null })),
  ]);

  constructor() {
    // A prévia acompanha o campo em que a pessoa está.
    effect(() => {
      const key = this.selectedKey();
      if (!key) return;
      setTimeout(() => document.querySelector(`[data-previa="${key}"]`)?.scrollIntoView({ block: 'nearest' }));
    });
  }

  /** O calendário do tema trabalha com Date; a API, com "aaaa-mm-dd". */
  readonly dueDateValue = computed(() => parseDateOnly(this.dueDate()));

  setDueDate(value: Date | null): void {
    this.dueDate.set(formatDateOnly(value));
  }

  ngOnInit(): void {
    const r = this.request();
    if (!r) return;
    this.id.set(r.id);
    this.title.set(r.title);
    this.instructions.set(r.instructions ?? '');
    this.dueDate.set(r.dueDate);
    this.fields.set(r.form.map(f => ({ ...f, options: [...(f.options ?? [])] })));
    this.templateFilename.set(r.templateFilename);
  }

  // ── Campos ──

  add(type: FieldType): void {
    const field = newField(type, this.fields());
    this.fields.set([...this.fields(), field]);
    this.select(field.key);
    // O foco vai para o nome do campo novo, já aberto: é a primeira coisa a escrever.
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-key="${field.key}"] .rb-campo__nome`);
      el?.scrollIntoView({ block: 'nearest' });
      el?.focus();
    });
  }

  /** Abre um campo; o que estava aberto conta como visitado (e passa a mostrar erro). */
  select(key: string): void {
    const previous = this.selectedKey();
    if (previous === key) return;
    if (previous) this.touched.set(new Set([...this.touched(), previous]));
    this.selectedKey.set(key);
  }

  /** O problema de um campo, só depois de visitado ou de uma tentativa de envio. */
  fieldProblem(field: RequestField): string | null {
    if (!this.attempted() && !this.touched().has(field.key)) return null;
    if (!field.label.trim()) return 'Dê um nome à pergunta.';
    if (field.type === 'CHOICE' && field.options.length === 0) return 'Escolha precisa de pelo menos uma opção.';
    return null;
  }

  patch(index: number, change: Partial<RequestField>): void {
    this.fields.set(this.fields().map((f, i) => (i === index ? { ...f, ...change } : f)));
  }

  move(index: number, delta: -1 | 1): void {
    const list = [...this.fields()];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.fields.set(list);
  }

  removeField(index: number): void {
    const removed = this.fields()[index];
    this.fields.set(this.fields().filter((_, i) => i !== index));
    if (removed && this.selectedKey() === removed.key) this.selectedKey.set(null);
  }

  addOption(index: number, input: HTMLInputElement): void {
    const value = input.value.trim();
    if (!value) return;
    const field = this.fields()[index];
    if (!field.options.includes(value)) this.patch(index, { options: [...field.options, value] });
    input.value = '';
  }

  removeOption(index: number, option: string): void {
    this.patch(index, { options: this.fields()[index].options.filter(o => o !== option) });
  }

  typeName(id: string | null): string | null {
    return id ? this.docTypes().find(t => t.id === id)?.name ?? null : null;
  }

  // ── Gravar ──

  /** Grava o rascunho; o primeiro clique cria, os seguintes atualizam. */
  saveDraft(): void {
    this.run(this.persist(), saved => this.saved.emit(saved));
  }

  /** Grava e envia: o público vira a lista de pessoas na API, e cada uma é avisada. */
  send(): void {
    // O botão fica ativo de propósito: clicar com algo faltando mostra o que falta,
    // em vez de um botão cinza que não explica nada.
    if (!this.canSend()) {
      this.attempted.set(true);
      if (this.ehCelular() && this.problems().length) this.mobileTab.set(this.title().trim() ? 'fields' : 'about');
      return;
    }
    this.run(this.persist().pipe(switchMap(saved => this.service.send(saved.id, this.audience()))),
      sent => this.saved.emit(sent));
  }

  /** O modelo precisa do rascunho existindo: se ainda é novo, grava antes. */
  onTemplate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.run(this.persist().pipe(switchMap(saved => this.service.uploadTemplate(saved.id, file))),
      saved => this.templateFilename.set(saved.templateFilename));
  }

  private persist(): Observable<DocumentRequest> {
    const body = {
      title: this.title().trim(),
      instructions: this.instructions().trim() || null,
      dueDate: this.dueDate() || null,
      form: this.fields().map(f => ({
        ...f,
        label: f.label.trim(),
        options: f.type === 'CHOICE' ? f.options : [],
        documentTypeId: f.type === 'FILE' ? f.documentTypeId : null,
      })),
    };
    const existing = this.id();
    const created$ = existing ? of(existing) : this.service.create(body.title || 'Nova solicitação').pipe(
      tap(r => this.id.set(r.id)), switchMap(r => of(r.id)));
    return created$.pipe(switchMap(id => this.service.update(id, body)));
  }

  private run<T>(call: Observable<T>, done: (value: T) => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: value => {
        this.saving.set(false);
        done(value);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(apiMessage(err) ?? 'Não foi possível gravar a solicitação.');
      },
    });
  }
}
