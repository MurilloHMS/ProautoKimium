import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { InventoryProduct, InventoryProductResponse } from '../../../../../../domain/models/products.model';
import { InventoryProductService } from '../../../../../../infrastructure/services/company/inventory/inventory-product.service';
import { FormScreenComponent } from '../../../../shared/form-screen/form-screen.component';
import { ToolbarComponent } from '../../../../shared/toolbar/toolbar.component';
import { PkButtonComponent } from '../../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { TabDirtyCheck } from '../../../../../../infrastructure/routing/tab-dirty-check';

@Component({
    selector: 'app-products',
    imports: [
        TableModule, CommonModule, ButtonModule, ToolbarModule,
        DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule,
        FormScreenComponent, ToolbarComponent, PkButtonComponent, PkCheckboxComponent
    ],
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss'
})
export class ProductsComponent implements TabDirtyCheck {

  /** Cadastro em andamento avisa antes de fechar a aba. */
  isTabDirty(): boolean {
    return this.mode() === 'form' && this.form.dirty;
  }

  closeForm(): void {
    this.mode.set('grid');
  }

  products: InventoryProductResponse[] = [];
  loading: boolean = false;
  /** grade ou formulário — o produto não é mais cadastrado em diálogo. */
  readonly mode = signal<'grid' | 'form'>('grid');
  product: InventoryProduct | null = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Produto';
  productToEdit: InventoryProductResponse | null = null;

  constructor(private productService: InventoryProductService, private fb: FormBuilder){
    this.form = this.fb.group({
      systemCode: ['', Validators.required],
      name: ['', Validators.required],
      active: [true, Validators.required],
      minimumStock: [0, Validators.required],
    });
  }

  loadProducts(){
    this.loading = true;
    this.productService.getInventoryProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        alert('Error loading products' + err.message);
        this.loading = false;
      }
    });
  }

  editProduct(product: InventoryProductResponse) {
    this.dialogTitle = 'Editar Produto';
    this.productToEdit = product;
    this.form.patchValue({
      systemCode: product.systemCode,
      name: product.name,
      active: product.active,
      minimumStock: product.minimumStock
    });
    this.mode.set('form');
  }

  showDialog(){
    this.dialogTitle = 'Adicionar Produto';
    this.productToEdit = null;
    this.form.reset({
      active: true,
      minimumStock: 0
    });
    this.mode.set('form');
  }

  saveProduct(){
    if(this.form.valid){
      const productData: InventoryProduct = this.form.value;

      if(this.productToEdit){
        this.productService.updateProduct(productData).subscribe({
          next: () => {
            this.mode.set('grid');
            this.loadProducts();
          },
          error: (err) => {
            alert('Error updating product: ' + err.message);
          }
        });
      }else{
        this.productService.addInventoryProduct(productData).subscribe({
          next: () => {
            this.mode.set('grid');
            this.loadProducts();
          },
          error: (err) => {
            alert('Error adding product: ' + err.message);
          }
        });
      }
    };
  }
}
