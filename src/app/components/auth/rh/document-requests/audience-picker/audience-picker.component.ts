import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PkMultiselectComponent } from '../../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { PkSegmentedComponent, PkSegmentedOption } from '../../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { AudienceOptions } from '../../../../../domain/models/events.model';
import { Audience } from '../../../../../domain/models/hr/document-request.model';

type Mode = 'ALL' | 'COMPANY' | 'DEPARTMENT' | 'PEOPLE';

/**
 * Quem recebe, como nos Eventos: todos, ou empresas, setores e pessoas.
 *
 * Usado no envio e em "Adicionar pessoas". A API resolve quem são as pessoas
 * (todas as ativas, com login ou sem) e não repete quem já recebeu; aqui é só a escolha.
 */
@Component({
  selector: 'app-audience-picker',
  standalone: true,
  imports: [FormsModule, PkMultiselectComponent, PkSegmentedComponent],
  template: `
    <div class="ap">
      <pk-segmented [options]="modes" [value]="mode()" (valueChange)="setMode($event)" ariaLabel="Quem recebe" size="sm" />
      @switch (mode()) {
        @case ('COMPANY') {
          <pk-multiselect [options]="options()?.companies ?? []" optionLabel="name" optionValue="id"
                          placeholder="Escolha as empresas" [ngModel]="audience().companyIds"
                          (ngModelChange)="patch({ companyIds: $event ?? [] })" [ngModelOptions]="{ standalone: true }" />
        }
        @case ('DEPARTMENT') {
          <pk-multiselect [options]="options()?.departments ?? []" optionLabel="name" optionValue="id"
                          placeholder="Escolha os setores" [ngModel]="audience().departmentIds"
                          (ngModelChange)="patch({ departmentIds: $event ?? [] })" [ngModelOptions]="{ standalone: true }" />
        }
        @case ('PEOPLE') {
          <pk-multiselect [options]="people()" optionLabel="label" optionValue="id"
                          placeholder="Escolha as pessoas" [ngModel]="audience().employeeIds"
                          (ngModelChange)="patch({ employeeIds: $event ?? [] })" [ngModelOptions]="{ standalone: true }" />
        }
      }
      <p class="ap__dica">{{ hint() }}</p>
    </div>
  `,
  styles: [`
    .ap { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .ap__dica { margin: 0; color: var(--app-text-muted); font-size: var(--text-ui-sm); }
  `],
})
export class AudiencePickerComponent {
  readonly options = input<AudienceOptions | null>(null);
  readonly audience = model<Audience>(emptyAudience());

  readonly modes: PkSegmentedOption[] = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Por empresa', value: 'COMPANY' },
    { label: 'Por setor', value: 'DEPARTMENT' },
    { label: 'Pessoas', value: 'PEOPLE' },
  ];

  readonly mode = computed<Mode>(() => {
    const a = this.audience();
    if (a.all) return 'ALL';
    if (a.employeeIds.length) return 'PEOPLE';
    if (a.departmentIds.length) return 'DEPARTMENT';
    if (a.companyIds.length) return 'COMPANY';
    return this.chosen;
  });

  /** O nome com empresa e setor: dois "Carlos" precisam ser distinguíveis. */
  readonly people = computed(() => (this.options()?.employees ?? [])
    .map(e => ({ id: e.id, label: [e.name, e.detail, e.hasAccess === false ? 'sem acesso' : null].filter(Boolean).join(' · ') })));

  readonly hint = computed(() => this.audience().all
    ? 'Todos os funcionários ativos. Quem não tem acesso ao portal recebe também, e o RH registra a resposta.'
    : 'A lista fecha no envio. Quem entrar depois, acrescente pelo "Adicionar pessoas".');

  /** O modo escolhido enquanto nada foi marcado ainda: sem isto, a escolha voltaria para "Todos". */
  private chosen: Mode = 'ALL';

  setMode(mode: Mode): void {
    this.chosen = mode;
    this.audience.set({ ...emptyAudience(), all: mode === 'ALL' });
  }

  patch(change: Partial<Audience>): void {
    this.audience.set({ ...this.audience(), ...change, all: false });
  }
}

export function emptyAudience(): Audience {
  return { all: true, companyIds: [], departmentIds: [], employeeIds: [] };
}

/** "Escolher" sem marcar nada convidaria ninguém: a API recusa, e o botão fica desligado antes. */
export function audienceIsEmpty(a: Audience): boolean {
  return !a.all && !a.companyIds.length && !a.departmentIds.length && !a.employeeIds.length;
}
