import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { DepartmentStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';

@Component({
  selector: 'app-org-structure-teams',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectModule, TableModule, Toast, PkButtonComponent, PkTableComponent, PkInputComponent, FormScreenComponent],
  templateUrl: './org-structure-teams.component.html',
  styleUrl: './org-structure-teams.component.scss',
  providers: [MessageService],
})
export class OrgStructureTeamsComponent implements OnInit {

  private readonly store = inject(TeamStore);
  private readonly departmentStore = inject(DepartmentStore);
  private readonly fb = inject(FormBuilder);
  private readonly msgService = inject(MessageService);

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

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    departmentId: [null, Validators.required],
  });

  ngOnInit(): void {
    this.store.load();
    this.departmentStore.load();
  }

  reload(): void {
    this.store.refresh();
  }

  openForm(): void {
    this.form.reset();
    this.mode.set('form');
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  save(): void {
    if (!this.form.valid) return;

    this.store.create(this.form.value).subscribe({
      next: () => {
        this.closeForm();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Setor cadastrado com sucesso!' });
      },
      error: (err) => {
        // Erro mantém o formulário aberto: o usuário não perde o que digitou.
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
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
