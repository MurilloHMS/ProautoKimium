import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { DepartmentStore } from '../../../../infrastructure/state/org-structure.store';
import { Department } from '../../../../domain/models/hr/org-structure.model';

@Component({
  selector: 'app-org-structure-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, ConfirmDialogModule, PkButtonComponent, PkTableComponent, PkInputComponent, FormScreenComponent, ToolbarComponent],
  templateUrl: './org-structure-departments.component.html',
  styleUrl: './org-structure-departments.component.scss',
  providers: [MessageService, ConfirmationService],
})
export class OrgStructureDepartmentsComponent implements OnInit, TabDirtyCheck {

  private readonly store = inject(DepartmentStore);
  private readonly fb = inject(FormBuilder);
  private readonly msgService = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly departments = this.store.items;
  readonly loading = this.store.loading;

  /** A tela alterna entre a grade e o formulário; não há mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');

  /**
   * O departamento em edição — `null` quando o formulário é de cadastro.
   *
   * É o que decide entre criar e atualizar no `save()`, e é por isso que
   * `openForm()` precisa limpá-lo: sem isso, cadastrar logo depois de editar
   * atualizaria o item anterior.
   */
  readonly editing = signal<Department | null>(null);

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
  });

  /** A aba avisa antes de fechar se o formulário estiver preenchido. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  ngOnInit(): void {
    this.store.load();
  }

  reload(): void {
    this.store.refresh();
  }

  openForm(): void {
    this.editing.set(null);
    this.form.reset();
    this.mode.set('form');
  }

  openEdit(department: Department): void {
    this.editing.set(department);
    this.form.reset({ name: department.name });
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
          detail: emEdicao ? 'Departamento atualizado com sucesso!' : 'Departamento cadastrado com sucesso!',
        });
      },
      error: (err) => {
        // Erro mantém o formulário aberto: o usuário não perde o que digitou.
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  /**
   * Pergunta antes, porque excluir não tem volta pela tela.
   *
   * A API é quem sabe se o departamento está em uso — a tela não tenta
   * adivinhar. Ela pede, e mostra o que voltar.
   */
  confirmDelete(department: Department): void {
    this.confirm.confirm({
      message: `Deseja excluir o departamento <strong>${department.name}</strong>?`,
      header: 'Confirmar exclusão',
      icon: 'pi pi-trash',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => this.excluir(department),
    });
  }

  excluir(department: Department): void {
    this.store.delete(department.id).subscribe({
      next: () => this.msgService.add({
        severity: 'success', summary: 'Excluído',
        detail: `Departamento "${department.name}" removido.`,
      }),
      error: (err) => this.msgService.add({
        severity: 'warning', summary: 'Não foi possível excluir',
        detail: this.getErrorMessage(err),
      }),
    });
  }

  /**
   * **A frase da API ganha da tabela de códigos.**
   *
   * O 409 aqui tem dois significados: nome repetido no cadastro, e
   * departamento em uso na exclusão. Traduzir o código para "Registro já
   * existe" acertaria o primeiro e mentiria no segundo — e é justamente na
   * exclusão que a mensagem do servidor diz QUEM está usando, que é a única
   * informação capaz de desbloquear quem clicou.
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
