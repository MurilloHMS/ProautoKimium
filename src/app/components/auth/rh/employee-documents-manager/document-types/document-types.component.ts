import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PkMultiselectComponent } from '../../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { EmployeeStore } from '../../../../../infrastructure/state/employee.store';
import { ehCelular } from '../../../../../infrastructure/state/eh-celular';
import { EmployeeDocumentService } from '../../../../../infrastructure/services/hr/employee-document.service';
import { EmployeeDocumentType } from '../../../../../domain/models/hr/employee-document.model';
import { apiMessageOrFallback } from '../../../../../domain/utils/api-error';

/** Três anos: um aviso mais cedo que isso é erro de digitação, não prazo. */
const MAX_DAYS_BEFORE = 1095;

/**
 * Tipos de documento e os seus avisos — aberto de dentro da tela de
 * documentos (decisão dele, 2026-09-29), só para quem tem CONFIGURAR.
 *
 * A frase no fim do formulário traduz a configuração em "quem recebe o quê, e
 * quando": "60, 15" sozinho não diz a ninguém que o aviso chega dois meses
 * antes.
 */
@Component({
  selector: 'app-document-types',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, PkButtonComponent, PkDialogComponent,
    PkSheetComponent, PkMultiselectComponent],
  templateUrl: './document-types.component.html',
  styleUrl: './document-types.component.scss',
})
export class DocumentTypesComponent {

  private readonly service = inject(EmployeeDocumentService);
  private readonly employeeStore = inject(EmployeeStore);

  readonly open = input(false);
  readonly types = input<EmployeeDocumentType[]>([]);

  readonly closed = output<void>();
  /** Um tipo foi criado ou alterado: a tela recarrega a lista dela. */
  readonly changed = output<EmployeeDocumentType>();

  readonly ehCelular = ehCelular();
  readonly employeeOptions = this.employeeStore.activeOptions;

  /** `undefined` = nada aberto; `null` = tipo novo; id = editando. */
  readonly editing = signal<string | null | undefined>(undefined);

  readonly name = signal('');
  readonly days = signal<number[]>([]);
  readonly dayInput = signal('');
  readonly notifyOnExpiry = signal(true);
  readonly recipients = signal<string[]>([]);
  readonly active = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly formOpen = computed(() => this.editing() !== undefined);

  /**
   * A frase de prévia, com uma data de exemplo: um documento que vence daqui a
   * tantos dias quanto o maior aviso, mais um mês — assim todos os avisos caem
   * no futuro e aparecem na frase.
   */
  readonly preview = computed(() => {
    const days = this.days();
    const people = this.recipients().map(id => this.employeeStore.nameOf(id).split(' ')[0]);
    if (!days.length && !this.notifyOnExpiry()) return 'Sem aviso: os documentos deste tipo mostram a situação na lista, mas ninguém é avisado.';
    if (!people.length) return 'Ninguém recebe o aviso ainda: escolha quem cuida deste tipo de documento.';

    const today = new Date();
    const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + Math.max(0, ...days) + 30);
    const at = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const moments = days.map(n => {
      const date = new Date(due.getFullYear(), due.getMonth(), due.getDate() - n);
      return `${at(date)} (${n} ${n === 1 ? 'dia' : 'dias'})`;
    });
    if (this.notifyOnExpiry()) moments.push(`no dia ${at(due)}`);

    return `Um documento que vence em ${at(due)} avisa ${joinPt(people)} em ${joinPt(moments)}, pelo sino e por e-mail.`;
  });

  constructor() {
    this.employeeStore.load();
    // Fechou a janela, fecha o formulário junto: reabrir mostra a lista.
    effect(() => {
      if (!this.open()) untracked(() => this.editing.set(undefined));
    });
  }

  edit(type: EmployeeDocumentType): void {
    this.editing.set(type.id);
    this.name.set(type.name);
    this.days.set([...type.alertDaysBefore]);
    this.notifyOnExpiry.set(type.notifyOnExpiry);
    this.recipients.set([...type.recipientEmployeeIds]);
    this.active.set(type.active);
    this.dayInput.set('');
    this.error.set(null);
  }

  create(): void {
    this.editing.set(null);
    this.name.set('');
    this.days.set([30]);
    this.notifyOnExpiry.set(true);
    this.recipients.set([]);
    this.active.set(true);
    this.dayInput.set('');
    this.error.set(null);
  }

  /** Aceita "30" ou "30, 7" de uma vez; recusa zero, negativo e repetido. */
  addDays(): void {
    const parts = this.dayInput().split(/[,\s;]+/).filter(Boolean);
    const next = new Set(this.days());
    for (const part of parts) {
      const value = Number(part);
      if (!Number.isInteger(value) || value <= 0 || value > MAX_DAYS_BEFORE) {
        this.error.set(`"${part}" não serve: use dias inteiros de 1 a ${MAX_DAYS_BEFORE}.`);
        return;
      }
      next.add(value);
    }
    this.days.set([...next].sort((a, b) => b - a));
    this.dayInput.set('');
    this.error.set(null);
  }

  removeDay(day: number): void {
    this.days.update(list => list.filter(item => item !== day));
  }

  save(): void {
    if (!this.name().trim() || this.saving()) return;
    // O que ficou digitado e não foi adicionado entra junto: perder "15"
    // porque ninguém apertou Enter seria uma pegadinha.
    if (this.dayInput().trim()) {
      this.addDays();
      if (this.error()) return;
    }

    this.saving.set(true);
    this.error.set(null);
    const body = {
      name: this.name().trim(),
      alertDaysBefore: this.days(),
      notifyOnExpiry: this.notifyOnExpiry(),
      recipientEmployeeIds: this.recipients(),
      active: this.active(),
    };
    const id = this.editing();
    const request = id ? this.service.updateType(id, body) : this.service.createType(body);

    request.subscribe({
      next: (type) => {
        this.saving.set(false);
        this.editing.set(type.id);
        this.changed.emit(type);
      },
      error: async (err) => {
        this.saving.set(false);
        this.error.set(await apiMessageOrFallback(err, 'Não foi possível salvar o tipo.'));
      },
    });
  }

  closeForm(): void {
    this.editing.set(undefined);
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  /** "30 · 7 dias", "sem aviso" ou "inativo" — a linha da lista. */
  summary(type: EmployeeDocumentType): string {
    if (!type.active) return 'inativo';
    if (!type.alertDaysBefore.length) return type.notifyOnExpiry ? 'só no dia' : 'sem aviso';
    return `${type.alertDaysBefore.join(' · ')} dias`;
  }
}

/** "a", "a e b", "a, b e c". */
function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
