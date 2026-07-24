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
import { CompanyService } from '../../../../infrastructure/services/hr/company.service';
import { Company } from '../../../../domain/models/hr/org-structure.model';

@Component({
  selector: 'app-org-structure-companies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, PkButtonComponent, PkDialogComponent, PkTableComponent, PkInputComponent],
  templateUrl: './org-structure-companies.component.html',
  styleUrl: './org-structure-companies.component.scss',
  providers: [MessageService],
})
export class OrgStructureCompaniesComponent implements OnInit {
  companies: Company[] = [];
  loading = false;
  visible = false;
  form: FormGroup;

  constructor(
    private companyService: CompanyService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      legalName: ['', Validators.required],
      cnpj: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.companyService.getAll().subscribe({
      next: (list) => {
        this.companies = list;
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

    this.companyService.create(this.form.value).subscribe({
      next: () => {
        this.visible = false;
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Empresa cadastrada com sucesso!' });
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
