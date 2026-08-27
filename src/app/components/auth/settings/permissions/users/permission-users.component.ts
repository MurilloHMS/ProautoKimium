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
  ApplyMode, PermissionCells, ScreenRow, TemplateSummary, UserGrid, UserSummary,
} from '../../../../../domain/models/permission-admin.model';

const SCREEN = 'settings/permissions/users';

/**
 * O que uma pessoa pode — e **aqui é a verdade**.
 *
 * Nada nesta tela é herdado: toda célula é editável e nenhuma vem de um pai. O
 * modelo já carimbou; o que ficou escrito na pessoa é o que vale, e é por isso
 * que "o que o João pode?" se responde olhando o João.
 *
 * O ponto âmbar é a única concessão ao histórico: ele marca a célula que difere
 * dos carimbos aplicados. Sem ele, reaplicar um modelo é um clique cego que
 * devolve permissões que alguém tirou de propósito.
 */
@Component({
  selector: 'app-permission-users',
  standalone: true,
  imports: [ToastModule, PkButtonComponent, PkDialogComponent, PermissionGridComponent],
  templateUrl: './permission-users.component.html',
  styleUrl: './permission-users.component.scss',
  providers: [MessageService],
})
export class PermissionUsersComponent implements OnInit, TabDirtyCheck {

  private readonly api = inject(PermissionAdminService);
  private readonly toast = inject(MessageService);
  private readonly permissions = inject(PermissionStore);

  private readonly grid = viewChild(PermissionGridComponent);

  readonly screens = signal<ScreenRow[]>([]);
  readonly users = signal<UserSummary[]>([]);
  readonly templates = signal<TemplateSummary[]>([]);
  readonly selected = signal<UserGrid | null>(null);

  readonly search = signal('');
  readonly changed = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly canEdit = computed(() => this.permissions.can(SCREEN, 'ALTERAR'));
  readonly canConfigure = computed(() => this.permissions.can(SCREEN, 'CONFIGURAR'));

  readonly visibleUsers = computed(() => {
    const termo = this.search().trim().toLowerCase();
    return this.users().filter(u => !termo
      || u.name.toLowerCase().includes(termo)
      || u.login.toLowerCase().includes(termo));
  });

  /**
   * Quantas células diferem dos carimbos aplicados.
   *
   * É o que o aviso do topo conta. Calculado no front a partir do que a API já
   * mandou — uma segunda requisição para descobrir um número que está na tela
   * seria trabalho por nada.
   */
  readonly divergences = computed(() => {
    const pessoa = this.selected();
    if (!pessoa) return 0;

    const chaves = (cells: PermissionCells) => {
      const set = new Set<string>();
      for (const [tela, acoes] of Object.entries(cells ?? {})) {
        for (const acao of acoes ?? []) set.add(`${tela}:${acao}`);
      }
      return set;
    };

    const agora = chaves(pessoa.cells);
    const carimbado = chaves(pessoa.stamped);
    if (!carimbado.size) return 0;

    let total = 0;
    for (const chave of agora) if (!carimbado.has(chave)) total++;
    for (const chave of carimbado) if (!agora.has(chave)) total++;
    return total;
  });

  // ─── Diálogo: aplicar modelo ───────────────────────────────────────────────

  readonly applyOpen = signal(false);
  readonly applyTargets = signal<string[]>([]);
  readonly applyTemplateId = signal<string | null>(null);
  readonly applyMode = signal<ApplyMode>('SOMAR');

  readonly applyTemplateName = computed(() =>
    this.templates().find(t => t.id === this.applyTemplateId())?.name ?? '');

  // ─── Diálogo: copiar de outra pessoa ───────────────────────────────────────

  readonly copyOpen = signal(false);
  readonly copySourceId = signal<string | null>(null);

  readonly copyCandidates = computed(() =>
    this.users().filter(u => u.id !== this.selected()?.id));

  isTabDirty(): boolean {
    return this.changed() > 0;
  }

  ngOnInit(): void {
    this.loading.set(true);

    this.api.screens().subscribe({
      next: telas => this.screens.set(telas),
      error: () => this.falhou('Não foi possível carregar o catálogo de telas.'),
    });

    this.api.templates().subscribe({
      next: modelos => this.templates.set(modelos.filter(m => m.active)),
      error: () => this.falhou('Não foi possível carregar os modelos.'),
    });

    this.reloadUsers(true);
  }

  private reloadUsers(selectFirst = false): void {
    this.api.users().subscribe({
      next: pessoas => {
        this.users.set(pessoas);
        this.loading.set(false);
        if (selectFirst && pessoas.length) this.select(pessoas[0]);
      },
      error: () => {
        this.loading.set(false);
        this.falhou('Não foi possível carregar os usuários.');
      },
    });
  }

  select(user: UserSummary): void {
    if (this.changed() > 0 && !confirm(
      'Há alterações não gravadas nesta pessoa. Trocar descarta.')) return;

    this.api.userGrid(user.id).subscribe({
      next: grade => this.selected.set(grade),
      error: () => this.falhou('Não foi possível abrir as permissões desta pessoa.'),
    });
  }

  private reloadSelected(): void {
    const pessoa = this.selected();
    if (!pessoa) return;
    this.api.userGrid(pessoa.id).subscribe({ next: grade => this.selected.set(grade) });
  }

  // ─── Gravar ────────────────────────────────────────────────────────────────

  save(): void {
    const grade = this.grid();
    const pessoa = this.selected();
    if (!grade || !pessoa) return;

    this.saving.set(true);
    this.api.saveUserGrid(pessoa.id, grade.current()).subscribe({
      next: resultado => {
        this.saving.set(false);
        this.reloadSelected();
        this.toast.add({
          severity: 'success',
          summary: 'Permissões gravadas',
          detail: `${resultado.cellsChanged} células alteradas. Vale a partir da próxima requisição dela.`,
        });
      },
      error: () => {
        this.saving.set(false);
        this.falhou('Não foi possível gravar as permissões.');
      },
    });
  }

  discard(): void {
    this.grid()?.discard();
  }

  // ─── Aplicar modelo ────────────────────────────────────────────────────────

  openApplyToCurrent(): void {
    const pessoa = this.selected();
    if (!pessoa) return;
    this.applyTargets.set([pessoa.id]);
    this.applyTemplateId.set(this.templates()[0]?.id ?? null);
    this.applyMode.set('SOMAR');
    this.applyOpen.set(true);
  }

  openApplyToMany(): void {
    this.applyTargets.set([]);
    this.applyTemplateId.set(this.templates()[0]?.id ?? null);
    this.applyMode.set('SOMAR');
    this.applyOpen.set(true);
  }

  toggleTarget(userId: string): void {
    const alvos = new Set(this.applyTargets());
    alvos.has(userId) ? alvos.delete(userId) : alvos.add(userId);
    this.applyTargets.set([...alvos]);
  }

  isTarget(userId: string): boolean {
    return this.applyTargets().includes(userId);
  }

  confirmApply(): void {
    const modelo = this.applyTemplateId();
    const alvos = this.applyTargets();
    if (!modelo || !alvos.length) {
      this.falhou('Escolha um modelo e pelo menos uma pessoa.');
      return;
    }

    this.api.apply(modelo, alvos, this.applyMode()).subscribe({
      next: resultado => {
        this.applyOpen.set(false);
        this.reloadUsers();
        this.reloadSelected();
        this.toast.add({
          severity: 'success',
          summary: `${this.applyTemplateName()} aplicado a ${resultado.users}`,
          detail: `${resultado.cellsChanged} células alteradas.`,
        });
      },
      error: () => this.falhou('Não foi possível aplicar o modelo.'),
    });
  }

  // ─── Copiar de outra pessoa ────────────────────────────────────────────────

  openCopy(): void {
    this.copySourceId.set(null);
    this.copyOpen.set(true);
  }

  confirmCopy(): void {
    const pessoa = this.selected();
    const origem = this.copySourceId();
    if (!pessoa || !origem) {
      this.falhou('Escolha de quem copiar.');
      return;
    }

    this.api.copyFrom(pessoa.id, origem).subscribe({
      next: resultado => {
        this.copyOpen.set(false);
        this.reloadUsers();
        this.reloadSelected();
        this.toast.add({
          severity: 'success',
          summary: 'Permissões copiadas',
          detail: `${resultado.cellsChanged} células alteradas.`,
        });
      },
      error: () => this.falhou('Não foi possível copiar as permissões.'),
    });
  }

  private falhou(detail: string): void {
    this.toast.add({ severity: 'error', summary: 'Não deu', detail });
  }
}
