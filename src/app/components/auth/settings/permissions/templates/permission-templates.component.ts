import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PermissionGridComponent } from '../permission-grid/permission-grid.component';
import { PermissionAdminService } from '../../../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../../../infrastructure/state/permission.store';
import { TabDirtyCheck } from '../../../../../infrastructure/routing/tab-dirty-check';
import {
  ScreenRow, TemplateGrid, TemplateSummary, UserSummary,
} from '../../../../../domain/models/permission-admin.model';

const SCREEN = 'settings/permissions/templates';

/**
 * O que o carimbo contém.
 *
 * A tela existe para configurar **modelos**, não pessoas — e a diferença é a
 * coisa mais importante que ela precisa comunicar. Mexer aqui não muda o acesso
 * de ninguém que já foi carimbado; por isso o aviso do topo diz quantas pessoas
 * usaram o modelo e é o único lugar de onde parte um "reaplicar".
 *
 * Sem esse aviso o risco é silencioso: alguém corrige o modelo, sai satisfeito,
 * e ninguém no sistema foi corrigido.
 */
@Component({
  selector: 'app-permission-templates',
  standalone: true,
  imports: [ToastModule, PkButtonComponent, PkDialogComponent, PermissionGridComponent],
  templateUrl: './permission-templates.component.html',
  styleUrl: './permission-templates.component.scss',
  providers: [MessageService],
})
export class PermissionTemplatesComponent implements OnInit, TabDirtyCheck {

  private readonly api = inject(PermissionAdminService);
  private readonly toast = inject(MessageService);
  private readonly permissions = inject(PermissionStore);

  private readonly grid = viewChild(PermissionGridComponent);

  readonly screens = signal<ScreenRow[]>([]);
  readonly templates = signal<TemplateSummary[]>([]);
  readonly selected = signal<TemplateGrid | null>(null);
  readonly stampedUsers = signal<UserSummary[]>([]);

  readonly search = signal('');
  readonly changed = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** Sem `ALTERAR` a grade abre em leitura, e os botões de gravar somem. */
  readonly canEdit = computed(() => this.permissions.can(SCREEN, 'ALTERAR'));
  readonly canCreate = computed(() => this.permissions.can(SCREEN, 'INCLUIR'));
  readonly canApply = computed(() =>
    this.permissions.can('settings/permissions/users', 'CONFIGURAR'));

  readonly visibleTemplates = computed(() => {
    const termo = this.search().trim().toLowerCase();
    return this.templates().filter(t => !termo || t.name.toLowerCase().includes(termo));
  });

  readonly current = computed(() =>
    this.templates().find(t => t.id === this.selected()?.id) ?? null);

  // ─── Diálogo de criar / duplicar / renomear ────────────────────────────────

  readonly formOpen = signal(false);
  readonly formKind = signal<'new' | 'duplicate' | 'rename'>('new');
  readonly formName = signal('');
  readonly formDescription = signal('');

  readonly formTitle = computed(() => ({
    new: 'Novo modelo',
    duplicate: `Duplicar ${this.current()?.name ?? ''}`,
    rename: 'Renomear modelo',
  }[this.formKind()]));

  // ─── Diálogo de reaplicar ──────────────────────────────────────────────────

  readonly reapplyOpen = signal(false);

  /** A aba avisa antes de fechar com célula por gravar. */
  isTabDirty(): boolean {
    return this.changed() > 0;
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.api.screens().subscribe({
      next: telas => this.screens.set(telas),
      error: () => this.falhou('Não foi possível carregar o catálogo de telas.'),
    });
    this.reloadTemplates(true);
  }

  private reloadTemplates(selectFirst = false): void {
    this.api.templates().subscribe({
      next: modelos => {
        this.templates.set(modelos);
        this.loading.set(false);
        if (selectFirst && modelos.length) this.select(modelos[0]);
      },
      error: () => {
        this.loading.set(false);
        this.falhou('Não foi possível carregar os modelos.');
      },
    });
  }

  select(template: TemplateSummary): void {
    if (this.changed() > 0 && !confirm(
      'Há alterações não gravadas neste modelo. Trocar de modelo descarta.')) return;

    this.stampedUsers.set([]);
    this.api.templateGrid(template.id).subscribe({
      next: grade => this.selected.set(grade),
      error: () => this.falhou('Não foi possível abrir o modelo.'),
    });
    this.api.stampedWith(template.id).subscribe({
      next: pessoas => this.stampedUsers.set(pessoas),
      // Sem a lista o aviso perde o botão, mas a grade continua editável — não
      // vale interromper o trabalho por causa disso.
      error: () => this.stampedUsers.set([]),
    });
  }

  // ─── Gravar ────────────────────────────────────────────────────────────────

  save(): void {
    const grade = this.grid();
    const modelo = this.selected();
    if (!grade || !modelo) return;

    this.saving.set(true);
    this.api.saveTemplateGrid(modelo.id, grade.current()).subscribe({
      next: resultado => {
        this.saving.set(false);
        this.selected.set({ ...modelo, cells: grade.current() });
        this.reloadTemplates();
        this.toast.add({
          severity: 'success',
          summary: 'Modelo gravado',
          detail: resultado.cellsChanged === 0
            ? 'Nada mudou.'
            : `${resultado.cellsChanged} células alteradas. Quem já foi carimbado não mudou.`,
        });
      },
      error: () => {
        this.saving.set(false);
        this.falhou('Não foi possível gravar o modelo.');
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
        error: erro => this.falhou(this.mensagem(erro, 'Não foi possível renomear.')),
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
            ? `Nasceu com as ${criado.allowedCells} permissões do original.`
            : 'Nasceu com tudo fechado. Libere o que ele deve dar.',
        });
      },
      error: erro => this.falhou(this.mensagem(erro, 'Não foi possível criar o modelo.')),
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
          detail: 'Quem já foi carimbado com ele não perdeu nada.',
        });
      },
      error: () => this.falhou('Não foi possível alterar o modelo.'),
    });
  }

  // ─── Reaplicar ─────────────────────────────────────────────────────────────

  /**
   * O reaplicar sempre SUBSTITUI — é o que ele significa.
   *
   * Somar não "reaplica" nada: deixaria ligado o que o modelo passou a negar, e
   * a pessoa continuaria diferente do modelo. O preço é apagar ajuste
   * individual, e é por isso que o diálogo escreve isso antes do clique.
   */
  confirmReapply(): void {
    const modelo = this.current();
    const pessoas = this.stampedUsers();
    if (!modelo || !pessoas.length) return;

    this.api.apply(modelo.id, pessoas.map(p => p.id), 'SUBSTITUIR').subscribe({
      next: resultado => {
        this.reapplyOpen.set(false);
        this.toast.add({
          severity: 'success',
          summary: `Reaplicado em ${resultado.users} pessoas`,
          detail: `${resultado.cellsChanged} células alteradas.`,
        });
      },
      error: () => this.falhou('Não foi possível reaplicar o modelo.'),
    });
  }

  // ─── Miudezas ──────────────────────────────────────────────────────────────

  private mensagem(erro: unknown, padrao: string): string {
    const corpo = (erro as { error?: { message?: string } })?.error;
    return corpo?.message ?? padrao;
  }

  private falhou(detail: string): void {
    this.toast.add({ severity: 'error', summary: 'Não deu', detail });
  }
}
