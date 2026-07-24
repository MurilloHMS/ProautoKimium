import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { DepartmentService } from '../../../../infrastructure/services/hr/department.service';
import { Department } from '../../../../domain/models/hr/org-structure.model';

@Component({
  selector: 'app-org-structure-departments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, PkInputComponent],
  templateUrl: './org-structure-departments.component.html',
  styleUrl: './org-structure-departments.component.scss',
  providers: [MessageService],
})
export class OrgStructureDepartmentsComponent implements OnInit {
  departments: Department[] = [];
  loading = false;
  visible = false;
  form: FormGroup;

  constructor(
    private departmentService: DepartmentService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.departmentService.getAll().subscribe({
      next: (list) => {
        this.departments = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  showDialog(): void {
    this.form.reset();
    this.visible = true;
  }

  save(): void {
    if (!this.form.valid) return;

    this.departmentService.create(this.form.value).subscribe({
      next: () => {
        this.visible = false;
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Departamento cadastrado com sucesso!' });
      },
      error: (err) => {
        this.visible = false;
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
