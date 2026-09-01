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
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { CompanyStore } from '../../../../infrastructure/state/org-structure.store';

@Component({
  selector: 'app-org-structure-companies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, Toast, PkButtonComponent, PkTableComponent, PkInputComponent, FormScreenComponent, ToolbarComponent],
  templateUrl: './org-structure-companies.component.html',
  styleUrl: './org-structure-companies.component.scss',
  providers: [MessageService],
})
export class OrgStructureCompaniesComponent implements OnInit, TabDirtyCheck {

  private readonly store = inject(CompanyStore);
  private readonly fb = inject(FormBuilder);
  private readonly msgService = inject(MessageService);

  /** Lista compartilhada: o cadastro feito aqui aparece em qualquer tela aberta. */
  readonly companies = this.store.items;
  readonly loading = this.store.loading;

  /** A tela alterna entre a grade e o formulário; não há mais diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    legalName: ['', Validators.required],
    cnpj: ['', Validators.required],
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
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Empresa cadastrada com sucesso!' });
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
