import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { DepartmentStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { Team } from '../../../../domain/models/hr/org-structure.model';

@Component({
  selector: 'app-org-structure-teams',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectModule, TableModule, Toast, ConfirmDialogModule, PkButtonComponent, PkTableComponent, PkInputComponent, FormScreenComponent, ToolbarComponent],
  templateUrl: './org-structure-teams.component.html',
  styleUrl: './org-structure-teams.component.scss',
  providers: [MessageService, ConfirmationService],
})
export class OrgStructureTeamsComponent implements OnInit, TabDirtyCheck {

  private readonly store = inject(TeamStore);
  private readonly departmentStore = inject(DepartmentStore);
  private readonly fb = inject(FormBuilder);
  private readonly msgService = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly teams = this.store.items;
  readonly loading = this.store.loading;

  /**
   * Sai do store de departamentos: cadastrar um departamento na aba ao lado
   * já reflete aqui, sem recarregar a tela.
   */
  readonly departmentOptions = computed(() =>
    this.departmentStore.items().map(department => ({ label: department.name, value: department.id }))
  );

  /** A tela alterna entre a grade e o formulário; não há mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');

  /**
   * O item em edicao — `null` quando o formulario e de cadastro.
   *
   * E o que decide entre criar e atualizar no `save()`, e por isso
   * `openForm()` precisa limpa-lo: sem isso, cadastrar logo depois de editar
   * atualizaria o item anterior.
   */
  readonly editing = signal<Team | null>(null);

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    departmentId: [null, Validators.required],
  });

  /** A aba avisa antes de fechar se o formulário estiver preenchido. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  ngOnInit(): void {
    this.store.load();
    this.departmentStore.load();
  }

  reload(): void {
    this.store.refresh();
  }

  openEdit(item: Team): void {
    this.editing.set(item);
    this.form.reset({ name: item.name, departmentId: item.department?.id ?? null });
    this.mode.set('form');
  }

  openForm(): void {
    this.editing.set(null);
    this.form.reset();
    this.mode.set('form');
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  save(): void {
    if (!this.form.valid) return;

    const emEdicao = this.editing();
    const requisicao = emEdicao
      ? this.store.update(emEdicao.id, this.form.value)
      : this.store.create(this.form.value);

    requisicao.subscribe({
      next: () => {
        this.closeForm();
        this.msgService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: emEdicao ? 'Setor atualizado com sucesso!' : 'Setor cadastrado com sucesso!',
        });
      },
      error: (err) => {
        // Erro mantém o formulário aberto: o usuário não perde o que digitou.
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  confirmDelete(item: Team): void {
    this.confirm.confirm({
      message: `Deseja excluir o setor <strong>${item.name}</strong>?`,
      header: 'Confirmar exclusão',
      icon: 'pi pi-trash',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => this.excluir(item),
    });
  }

  excluir(item: Team): void {
    this.store.delete(item.id).subscribe({
      next: () => this.msgService.add({
        severity: 'success', summary: 'Excluído',
        detail: `Setor "${item.name}" removido.`,
      }),
      error: (err) => this.msgService.add({
        severity: 'warning', summary: 'Não foi possível excluir',
        detail: this.getErrorMessage(err),
      }),
    });
  }

  /**
   * **A frase da API ganha da tabela de codigos.**
   *
   * O 409 tem dois significados aqui: nome repetido no cadastro, e registro em
   * uso na exclusao. Traduzir o codigo para "Registro ja existe" acertaria o
   * primeiro e mentiria no segundo — e e na exclusao que a mensagem do
   * servidor diz QUEM esta usando, que e a unica informacao capaz de
   * desbloquear quem clicou.
   */
  private getErrorMessage(err: any): string {
    const doServidor = err?.error?.message;
    if (typeof doServidor === 'string' && doServidor.trim()) return doServidor;

    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Recurso não encontrado';
      case 409: return 'Registro já existe';
      case 422: return 'Dados inválidos';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
