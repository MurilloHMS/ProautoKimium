import { Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { ApplyMode, ApplyResult, TemplateSummary } from '../../../../domain/models/permission-admin.model';

/** Quem pode receber um modelo: o mínimo para a lista de marcar. */
export interface ApplyPerson {
  id: string;
  name: string;
  login: string;
}

/**
 * "Aplicar modelo", das duas abas da administração.
 *
 * Na aba Usuários a pessoa já está escolhida e se escolhe o modelo; na aba
 * Modelos é o contrário. É o mesmo ato — copiar as liberações de um modelo para
 * dentro de pessoas —, e por isso é um diálogo só: com dois, as duas frases
 * sobre Somar e Substituir divergiriam na primeira correção.
 */
@Component({
  selector: 'app-apply-template-dialog',
  standalone: true,
  imports: [PkButtonComponent, PkDialogComponent],
  templateUrl: './apply-template-dialog.component.html',
  styleUrl: './apply-template-dialog.component.scss',
})
export class ApplyTemplateDialogComponent {

  private readonly api = inject(PermissionAdminService);

  readonly open = input(false);
  readonly templates = input<TemplateSummary[]>([]);
  readonly people = input<ApplyPerson[]>([]);

  /** Modelo já escolhido (aba Modelos): a lista de modelos some. */
  readonly fixedTemplateId = input<string | null>(null);
  /** Pessoa já escolhida (aba Usuários): a lista de pessoas some. */
  readonly fixedPerson = input<ApplyPerson | null>(null);

  readonly closed = output<void>();
  readonly applied = output<ApplyResult>();
  readonly failed = output<string>();

  readonly templateId = signal<string | null>(null);
  readonly targets = signal<string[]>([]);
  readonly mode = signal<ApplyMode>('SOMAR');
  readonly busy = signal(false);

  readonly templateName = computed(() =>
    this.templates().find(t => t.id === this.templateId())?.name ?? '');

  readonly header = computed(() => {
    const pessoa = this.fixedPerson();
    if (pessoa) return `Aplicar modelo a ${pessoa.name}`;
    return this.fixedTemplateId() ? `Aplicar ${this.templateName()} a pessoas` : 'Aplicar modelo';
  });

  readonly total = computed(() => this.fixedPerson() ? 1 : this.targets().length);

  constructor() {
    // Toda abertura começa limpa: o que ficou marcado da última vez não é
    // escolha de agora.
    effect(() => {
      if (!this.open()) return;
      this.templateId.set(this.fixedTemplateId() ?? this.templates()[0]?.id ?? null);
      this.targets.set([]);
      this.mode.set('SOMAR');
    });
  }

  toggleTarget(id: string): void {
    const alvos = new Set(this.targets());
    alvos.has(id) ? alvos.delete(id) : alvos.add(id);
    this.targets.set([...alvos]);
  }

  isTarget(id: string): boolean {
    return this.targets().includes(id);
  }

  confirm(): void {
    const modelo = this.templateId();
    const alvos = this.fixedPerson() ? [this.fixedPerson()!.id] : this.targets();
    if (!modelo || !alvos.length) {
      this.failed.emit('Escolha um modelo e pelo menos uma pessoa.');
      return;
    }

    this.busy.set(true);
    this.api.apply(modelo, alvos, this.mode()).subscribe({
      next: resultado => {
        this.busy.set(false);
        this.applied.emit(resultado);
      },
      error: () => {
        this.busy.set(false);
        this.failed.emit('Não foi possível aplicar o modelo.');
      },
    });
  }
}
