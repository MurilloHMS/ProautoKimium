import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

import { InventoryProduct, InventoryProductResponse } from '../../../../domain/models/products.model';
import { InventoryProductStore } from '../../../../infrastructure/state/inventory-product.store';
import { TabDirtyCheck } from '../../../../infrastructure/routing/tab-dirty-check';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkFileUploadComponent } from '../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    TableModule, CommonModule, ButtonModule, InputTextModule, ReactiveFormsModule,
    CheckboxModule, Toast, Tooltip, FormScreenComponent, ToolbarComponent,
    PkButtonComponent, PkCheckboxComponent, PkDialogComponent, PkFileUploadComponent, PkTableComponent,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
  providers: [MessageService],
})
export class ProductsComponent implements OnInit, TabDirtyCheck {

  private readonly productStore = inject(InventoryProductStore);
  private readonly messageService = inject(MessageService);

  readonly loading = this.productStore.loading;
  readonly mode = signal<'grid' | 'form'>('grid');

  /**
   * Estoque baixo é FILTRO, não outra tela: no desktop era um botão que trocava
   * a lista inteira e escondia o resto. Aqui é um estado da mesma grade.
   */
  readonly onlyLowStock = signal(false);
  private readonly lowStockCodes = signal<ReadonlySet<string>>(new Set<string>());

  readonly products = computed(() => {
    const all = this.productStore.items();
    if (!this.onlyLowStock()) return all;

    const low = this.lowStockCodes();
    return all.filter(product => low.has(product.systemCode));
  });

  readonly lowStockCount = computed(() => this.lowStockCodes().size);

  form: FormGroup;
  formTitle = 'Adicionar Produto';
  productToEdit: InventoryProductResponse | null = null;
  uploading = false;

  deleteTarget: InventoryProductResponse | null = null;
  deleteVisible = false;
  deleting = false;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      systemCode: ['', Validators.required],
      name: ['', Validators.required],
      active: [true, Validators.required],
      minimumStock: [0, Validators.required],
    });
  }

  /** Cadastro em andamento avisa antes de fechar a aba. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  ngOnInit(): void {
    this.productStore.load();
    this.loadLowStock();
  }

  refresh(): void {
    this.productStore.refresh();
    this.loadLowStock();
  }

  /**
   * A API tem um endpoint próprio para estoque baixo. Guardamos só os códigos e
   * filtramos a lista do store — assim a grade continua vindo de uma fonte só.
   */
  private loadLowStock(): void {
    this.productStore.lowStock().subscribe({
      next: (list) => this.lowStockCodes.set(new Set(list.map(p => p.systemCode))),
      error: () => this.lowStockCodes.set(new Set()),
    });
  }

  toggleLowStock(): void {
    this.onlyLowStock.update(value => !value);
  }

  isLow(product: InventoryProductResponse): boolean {
    return this.lowStockCodes().has(product.systemCode);
  }

  // ─── Formulário ───────────────────────────────────────────────────────────

  newProduct(): void {
    this.formTitle = 'Adicionar Produto';
    this.productToEdit = null;
    this.form.reset({ active: true, minimumStock: 0 });
    this.form.get('systemCode')?.enable();
    this.mode.set('form');
  }

  editProduct(product: InventoryProductResponse): void {
    this.formTitle = 'Editar Produto';
    this.productToEdit = product;
    this.form.patchValue({
      systemCode: product.systemCode,
      name: product.name,
      active: product.active,
      minimumStock: product.minimumStock,
    });
    // O código do sistema é a chave usada pela API; mudar viraria outro produto.
    this.form.get('systemCode')?.disable();
    this.mode.set('form');
  }

  save(): void {
    if (this.form.invalid) return;

    const product = this.form.getRawValue() as InventoryProduct;
    const request = this.productToEdit
      ? this.productStore.update(product)
      : this.productStore.create(product);

    request.subscribe({
      next: () => {
        this.mode.set('grid');
        this.loadLowStock();
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: this.productToEdit ? 'Produto atualizado.' : 'Produto cadastrado.',
        });
      },
      error: (err: HttpErrorResponse) => this.showError(err),
    });
  }

  // ─── Exclusão ─────────────────────────────────────────────────────────────

  askDelete(product: InventoryProductResponse): void {
    this.deleteTarget = product;
    this.deleteVisible = true;
  }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target) return;

    this.deleting = true;
    this.productStore.deleteById(target.systemCode).subscribe({
      next: () => {
        this.deleting = false;
        this.deleteVisible = false;
        this.loadLowStock();
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Produto excluído.' });
      },
      error: (err: HttpErrorResponse) => {
        this.deleting = false;
        this.showError(err);
      },
    });
  }

  // ─── Planilha ─────────────────────────────────────────────────────────────

  onSheetSelected(files: File[]): void {
    const file = files[0];
    if (!file) return;

    this.uploading = true;
    this.productStore.uploadSheet(file).subscribe({
      next: (message) => {
        this.uploading = false;
        this.loadLowStock();
        this.messageService.add({
          severity: 'success',
          summary: 'Planilha processada',
          detail: message || 'Produtos importados.',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.uploading = false;
        this.showError(err);
      },
    });
  }

  private showError(err: HttpErrorResponse): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erro',
      detail: this.errorMessage(err),
    });
  }

  private errorMessage(err: HttpErrorResponse): string {
    switch (err.status) {
      case 0:   return 'Sem conexão com o servidor.';
      case 400: return 'Dados inválidos.';
      case 403: return 'Você não tem permissão para esta ação.';
      case 404: return 'Produto não encontrado.';
      case 409: return 'Já existe um produto com esse código.';
      default:  return typeof err.error === 'string' ? err.error : 'Erro inesperado.';
    }
  }
}
