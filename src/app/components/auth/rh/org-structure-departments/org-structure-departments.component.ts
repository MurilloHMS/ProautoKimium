import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { DepartmentStore } from '../../../../infrastructure/state/org-structure.store';

@Component({
  selector: 'app-org-structure-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, PkButtonComponent, PkTableComponent, PkInputComponent, FormScreenComponent],
  templateUrl: './org-structure-departments.component.html',
  styleUrl: './org-structure-departments.component.scss',
  providers: [MessageService],
})
export class OrgStructureDepartmentsComponent implements OnInit {

  private readonly store = inject(DepartmentStore);
  private readonly fb = inject(FormBuilder);
  private readonly msgService = inject(MessageService);

  readonly departments = this.store.items;
  readonly loading = this.store.loading;

  /** A tela alterna entre a grade e o formulário; não há mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
  });

  ngOnInit(): void {
    this.store.load();
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
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Departamento cadastrado com sucesso!' });
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
