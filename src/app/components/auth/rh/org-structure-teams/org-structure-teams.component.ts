import { Component, OnInit, signal } from '@angular/core';
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
import { TeamService } from '../../../../infrastructure/services/hr/team.service';
import { DepartmentService } from '../../../../infrastructure/services/hr/department.service';
import { Department, Team } from '../../../../domain/models/hr/org-structure.model';

@Component({
  selector: 'app-org-structure-teams',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectModule, TableModule, Toast, PkButtonComponent, PkTableComponent, PkInputComponent, FormScreenComponent],
  templateUrl: './org-structure-teams.component.html',
  styleUrl: './org-structure-teams.component.scss',
  providers: [MessageService],
})
export class OrgStructureTeamsComponent implements OnInit {
  teams: Team[] = [];
  departmentOptions: { label: string; value: string }[] = [];
  loading = false;

  /** A tela alterna entre a grade e o formulário; não há mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');
  form: FormGroup;

  constructor(
    private teamService: TeamService,
    private departmentService: DepartmentService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      departmentId: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.load();
    this.loadDepartmentOptions();
  }

  load(): void {
    this.loading = true;
    this.teamService.getAll().subscribe({
      next: (list) => {
        this.teams = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  loadDepartmentOptions(): void {
    this.departmentService.getAll().subscribe({
      next: (list: Department[]) => {
        this.departmentOptions = list.map((d) => ({ label: d.name, value: d.id }));
      },
      error: () => (this.departmentOptions = []),
    });
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

    this.teamService.create(this.form.value).subscribe({
      next: () => {
        this.closeForm();
        this.load();
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
