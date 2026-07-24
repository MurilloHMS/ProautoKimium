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
import { HierarchyService } from '../../../../infrastructure/services/hr/hierarchy.service';
import { Hierarchy } from '../../../../domain/models/hr/org-structure.model';

@Component({
  selector: 'app-org-structure-hierarchies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, PkInputComponent],
  templateUrl: './org-structure-hierarchies.component.html',
  styleUrl: './org-structure-hierarchies.component.scss',
  providers: [MessageService],
})
export class OrgStructureHierarchiesComponent implements OnInit {
  hierarchies: Hierarchy[] = [];
  loading = false;
  visible = false;
  form: FormGroup;

  constructor(
    private hierarchyService: HierarchyService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      levelOrder: [null, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  // Ordenada por nível — é o que dá sentido visual pra hierarquia (quem manda em quem).
  load(): void {
    this.loading = true;
    this.hierarchyService.getAll().subscribe({
      next: (list) => {
        this.hierarchies = [...list].sort((a, b) => a.levelOrder - b.levelOrder);
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

    this.hierarchyService.create(this.form.value).subscribe({
      next: () => {
        this.visible = false;
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Hierarquia cadastrada com sucesso!' });
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
