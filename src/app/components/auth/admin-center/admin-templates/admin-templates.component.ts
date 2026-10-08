import { Component, OnInit, computed, inject, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PermissionGridComponent } from '../permission-grid/permission-grid.component';
import { ApplyPerson, ApplyTemplateDialogComponent } from '../apply-template-dialog/apply-template-dialog.component';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import {
  ApplyResult, PERMISSION_LABELS, PermissionName, ReapplyPerson, ScreenRow, TemplateGrid,
  TemplateSummary, UserSummary,
} from '../../../../domain/models/permission-admin.model';

const SCREEN = 'settings/admin';

/**
 * A aba Modelos: o que cada modelo libera, e a quem ele já foi aplicado.
 *
 * A coisa mais importante que ela precisa comunicar: **aplicar um modelo copia**
 * as liberações para dentro da pessoa, e salvar o modelo depois não muda quem
 * já o recebeu. Por isso o aviso diz quem são essas pessoas, e o "Reaplicar"
 * mostra, pessoa por pessoa, o que vai mudar antes do clique — pedido dele em
 * 2026-10-08, quando a mensagem antiga não deixava claro o que o botão fazia.
 */
@Component({
  selector: 'app-admin-templates',
  standalone: true,
  imports: [
    NgTemplateOutlet, FormsModule,
    PkButtonComponent, PkInputComponent, PkDialogComponent, PkSheetComponent,
    PermissionGridComponent, ApplyTemplateDialogComponent,
  ],
  templateUrl: './admin-templates.component.html',
  styleUrl: './admin-templates.component.scss',
})
export class AdminTemplatesComponent implements OnInit {

  private readonly api = inject(PermissionAdminService);
  private readonly permissions = inject(PermissionStore);
  private readonly toast = inject(MessageService);

  readonly counted = output<number>();

  readonly celular = ehCelular();
  private readonly grid = viewChild(PermissionGridComponent);

  readonly screens = signal<ScreenRow[]>([]);
  readonly templates = signal<TemplateSummary[]>([]);
  readonly users = signal<UserSummary[]>([]);
  readonly selected = signal<TemplateGrid | null>(null);
  readonly appliedTo = signal<UserSummary[]>([]);
  readonly loading = signal(true);
  readonly sheetOpen = signal(false);

  readonly changed = signal(0);
  readonly saving = signal(false);

  readonly canEdit = computed(() => this.permissions.can(SCREEN, 'ALTERAR'));
  readonly canCreate = computed(() => this.permissions.can(SCREEN, 'INCLUIR'));
  readonly canConfigure = computed(() => this.permissions.can(SCREEN, 'CONFIGURAR'));

  readonly current = computed(() =>
    this.templates().find(t => t.id === this.selected()?.id) ?? null);

  /** Quem pode receber modelo: o desenvolvedor já tem tudo. */
  readonly people = computed<ApplyPerson[]>(() => this.users()
    .filter(u => !u.developer)
    .map(u => ({ id: u.id, name: u.name, login: u.login })));

  /** "Weslley, Carlos e Jéssica" — os nomes, e não só o número, porque é deles que se fala. */
  readonly appliedNames = computed(() => juntar(this.appliedTo().map(u => primeiroNome(u.name))));

  // ─── Criar / duplicar / renomear ───────────────────────────────────────────

  readonly formOpen = signal(false);
  readonly formKind = signal<'new' | 'duplicate' | 'rename'>('new');
  readonly formName = signal('');
  readonly formDescription = signal('');

  readonly formTitle = computed(() => ({
    new: 'Novo modelo',
    duplicate: `Duplicar ${this.current()?.name ?? ''}`,
    rename: 'Renomear modelo',
  }[this.formKind()]));

  // ─── Aplicar e reaplicar ───────────────────────────────────────────────────

  readonly applyOpen = signal(false);
  readonly reapplyOpen = signal(false);
  readonly reapplyPeople = signal<ReapplyPerson[] | null>(null);
  readonly reapplying = signal(false);

  readonly reapplyCount = computed(() => this.reapplyPeople()?.length ?? 0);

  /**
   * Quem o Reaplicar mudaria hoje: o aviso diz o nome antes de alguém clicar.
   *
   * As duas direções contam. Um ajuste à mão que TIROU algo aparece como
   * "recebe de volta" (`gains`), e um que deu algo a mais, como "perde"
   * (`loses`). Contar só o segundo dizia "ninguém tem ajuste" para o Weslley,
   * de quem alguém tinha tirado o Excluir — foi o teste de ponta a ponta que
   * mostrou.
   */
  readonly withChanges = computed(() =>
    (this.reapplyPeople() ?? []).filter(p => p.loses.length + p.gains.length > 0));

  ngOnInit(): void {
    this.api.screens().subscribe({
      next: telas => this.screens.set(telas),
      error: () => this.falhou('Não foi possível carregar o catálogo de telas.'),
    });
    this.api.users().subscribe({
      next: pessoas => this.users.set(pessoas),
      error: () => this.users.set([]),
    });
    this.reloadTemplates(!this.celular());
  }

  isTabDirty(): boolean {
    return this.changed() > 0;
  }

  private reloadTemplates(abrirPrimeiro = false): void {
    this.api.templates().subscribe({
      next: modelos => {
        this.templates.set(modelos);
        this.counted.emit(modelos.length);
        this.loading.set(false);
        if (abrirPrimeiro && modelos.length) this.select(modelos[0]);
      },
      error: () => {
        this.loading.set(false);
        this.falhou('Não foi possível carregar os modelos.');
      },
    });
  }

  select(template: TemplateSummary): void {
    if (template.id !== this.selected()?.id && this.changed() > 0
        && !confirm('Há alterações não salvas neste modelo. Trocar de modelo descarta.')) return;

    this.appliedTo.set([]);
    this.changed.set(0);
    if (this.celular()) this.sheetOpen.set(true);

    this.api.templateGrid(template.id).subscribe({
      next: grade => this.selected.set(grade),
      error: () => this.falhou('Não foi possível abrir o modelo.'),
    });
    this.loadAppliedTo(template.id);
  }

  private loadAppliedTo(templateId: string): void {
    this.api.appliedTo(templateId).subscribe({
      next: pessoas => {
        this.appliedTo.set(pessoas);
        this.reapplyPeople.set(null);
        if (pessoas.length) this.loadPreview(templateId);
      },
      // Sem a lista o aviso perde os nomes, mas a grade continua editável.
      error: () => this.appliedTo.set([]),
    });
  }

  private loadPreview(templateId: string): void {
    this.api.reapplyPreview(templateId).subscribe({
      next: previa => {
        if (this.selected()?.id === templateId || !this.selected()) this.reapplyPeople.set(previa.people);
      },
      error: () => this.reapplyPeople.set(null),
    });
  }

  closeSheet(): void {
    if (this.changed() > 0 && !confirm('Há alterações não salvas neste modelo. Fechar descarta.')) return;
    this.grid()?.discard();
    this.sheetOpen.set(false);
  }

  // ─── Salvar ────────────────────────────────────────────────────────────────

  save(): void {
    const grade = this.grid();
    const modelo = this.selected();
    if (!grade || !modelo) return;

    this.saving.set(true);
    const cells = grade.current();
    this.api.saveTemplateGrid(modelo.id, cells).subscribe({
      next: resultado => {
        this.saving.set(false);
        this.selected.set({ ...modelo, cells });
        this.reloadTemplates();
        // O que o Reaplicar faria mudou junto com o modelo.
        if (this.appliedTo().length) this.loadPreview(modelo.id);
        const alcancou = this.appliedTo().length;
        this.toast.add({
          severity: 'success',
          summary: 'Modelo salvo',
          detail: resultado.cellsChanged === 0
            ? 'Nada mudou.'
            : alcancou > 0
              ? `Quem já tinha o modelo continua como estava. Para levar a mudança a ${alcancou === 1 ? 'essa pessoa' : 'essas ' + alcancou + ' pessoas'}, use Reaplicar.`
              : `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'liberação mudou' : 'liberações mudaram'}.`,
        });
      },
      error: () => {
        this.saving.set(false);
        this.falhou('Não foi possível salvar o modelo.');
      },
    });
  }

  discard(): void {
    this.grid()?.discard();
  }

  // ─── Criar, duplicar, renomear, desativar ──────────────────────────────────

  openNew(): void {
    this.formKind.set('new');
    this.formName.set('');
    this.formDescription.set('');
    this.formOpen.set(true);
  }

  openDuplicate(): void {
    const modelo = this.current();
    if (!modelo) return;
    this.formKind.set('duplicate');
    this.formName.set(`${modelo.name} (cópia)`);
    this.formDescription.set(modelo.description ?? '');
    this.formOpen.set(true);
  }

  openRename(): void {
    const modelo = this.current();
    if (!modelo) return;
    this.formKind.set('rename');
    this.formName.set(modelo.name);
    this.formDescription.set(modelo.description ?? '');
    this.formOpen.set(true);
  }

  submitForm(): void {
    const nome = this.formName().trim();
    if (!nome) {
      this.falhou('O modelo precisa de um nome.');
      return;
    }
    const descricao = this.formDescription().trim() || null;

    if (this.formKind() === 'rename') {
      const modelo = this.current();
      if (!modelo) return;
      this.api.editTemplate(modelo.id, { name: nome, description: descricao ?? '' }).subscribe({
        next: () => {
          this.formOpen.set(false);
          this.selected.set({ ...this.selected()!, name: nome, description: descricao });
          this.reloadTemplates();
          this.toast.add({ severity: 'success', summary: 'Modelo renomeado' });
        },
        error: erro => this.falhou(mensagem(erro, 'Não foi possível renomear.')),
      });
      return;
    }

    const origem = this.formKind() === 'duplicate' ? this.current()?.id : undefined;
    this.api.createTemplate(nome, descricao, origem).subscribe({
      next: criado => {
        this.formOpen.set(false);
        this.reloadTemplates();
        this.select(criado);
        this.toast.add({
          severity: 'success',
          summary: 'Modelo criado',
          detail: origem
            ? 'Nasceu com as mesmas liberações do original.'
            : 'Nasceu sem nada liberado. Marque o que ele deve dar.',
        });
      },
      error: erro => this.falhou(mensagem(erro, 'Não foi possível criar o modelo.')),
    });
  }

  toggleActive(): void {
    const modelo = this.current();
    if (!modelo) return;

    this.api.editTemplate(modelo.id, { active: !modelo.active }).subscribe({
      next: () => {
        this.selected.set({ ...this.selected()!, active: !modelo.active });
        this.reloadTemplates();
        this.toast.add({
          severity: 'success',
          summary: modelo.active ? 'Modelo desativado' : 'Modelo reativado',
          detail: modelo.active
            ? 'Some do "Aplicar modelo". Quem já o recebeu não perde nada.'
            : 'Volta a aparecer no "Aplicar modelo".',
        });
      },
      error: () => this.falhou('Não foi possível alterar o modelo.'),
    });
  }

  // ─── Aplicar a pessoas ─────────────────────────────────────────────────────

  onApplied(resultado: ApplyResult): void {
    this.applyOpen.set(false);
    this.reloadTemplates();
    const modelo = this.selected();
    if (modelo) this.loadAppliedTo(modelo.id);
    this.toast.add({
      severity: 'success',
      summary: `Aplicado a ${resultado.users} ${resultado.users === 1 ? 'pessoa' : 'pessoas'}`,
      detail: `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'liberação mudou' : 'liberações mudaram'}.`,
    });
  }

  // ─── Reaplicar ─────────────────────────────────────────────────────────────

  /** Abre a confirmação já com a prévia: o que cada pessoa perde e ganha. */
  openReapply(): void {
    const modelo = this.selected();
    if (!modelo) return;
    this.reapplyOpen.set(true);
    // Recalcula ao abrir: alguém pode ter mexido numa dessas pessoas desde que
    // o modelo foi aberto, e a confirmação precisa dizer o que vale agora.
    this.api.reapplyPreview(modelo.id).subscribe({
      next: previa => this.reapplyPeople.set(previa.people),
      error: () => {
        this.reapplyOpen.set(false);
        this.falhou('Não foi possível calcular o que o Reaplicar faria.');
      },
    });
  }

  confirmReapply(): void {
    const modelo = this.selected();
    if (!modelo) return;

    this.reapplying.set(true);
    this.api.reapply(modelo.id).subscribe({
      next: resultado => {
        this.reapplying.set(false);
        this.reapplyOpen.set(false);
        this.loadAppliedTo(modelo.id);
        this.toast.add({
          severity: 'success',
          summary: `Reaplicado a ${resultado.users} ${resultado.users === 1 ? 'pessoa' : 'pessoas'}`,
          detail: resultado.cellsChanged === 0
            ? 'Ninguém mudou: todos já estavam como os modelos dizem.'
            : `${resultado.cellsChanged} ${resultado.cellsChanged === 1 ? 'liberação mudou' : 'liberações mudaram'}.`,
        });
      },
      error: () => {
        this.reapplying.set(false);
        this.falhou('Não foi possível reaplicar o modelo.');
      },
    });
  }

  /** "stock/products:EXCLUIR" vira "Excluir em Produtos". */
  describe(chave: string): string {
    const corte = chave.lastIndexOf(':');
    const tela = chave.slice(0, corte);
    const acao = chave.slice(corte + 1) as PermissionName;
    const rotulo = this.screens().find(s => s.code === tela)?.label ?? tela;
    return `${PERMISSION_LABELS[acao] ?? acao} em ${rotulo}`;
  }

  /** Até quatro, por extenso; o resto vira "e mais N" para a linha não virar parágrafo. */
  describeAll(chaves: string[]): string {
    const ditas = chaves.slice(0, 4).map(c => this.describe(c)).join(', ');
    return chaves.length > 4 ? `${ditas} e mais ${chaves.length - 4}` : ditas;
  }

  falhou(detail: string): void {
    this.toast.add({ severity: 'error', summary: 'Não deu', detail });
  }
}

function mensagem(erro: unknown, padrao: string): string {
  return (erro as { error?: { message?: string } })?.error?.message ?? padrao;
}

function primeiroNome(nome: string): string {
  return nome.split(/\s+/)[0] ?? nome;
}

/** ["A", "B", "C"] → "A, B e C". Com muitos nomes, os três primeiros e "mais N". */
function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  if (nomes.length > 4) return `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`;
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
