import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { InventoryProduct, InventoryProductResponse } from '../../../../../../domain/models/products.model';
import { InventoryProductService } from '../../../../../../infrastructure/services/company/inventory/inventory-product.service';

@Component({
    selector: 'app-products',
    imports: [
        TableModule, CommonModule, ButtonModule, ToolbarModule,
        DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule
    ],
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss'
})
export class ProductsComponent {
  products: InventoryProductResponse[] = [];
  loading: boolean = false;
  visible: boolean = false;
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
    this.visible = true;
  }

  showDialog(){
    this.dialogTitle = 'Adicionar Produto';
    this.productToEdit = null;
    this.form.reset({
      active: true,
      minimumStock: 0
    });
    this.visible = true;
  }

  saveProduct(){
    if(this.form.valid){
      const productData: InventoryProduct = this.form.value;

      if(this.productToEdit){
        // Edit mode
      }else{
        this.productService.addInventoryProduct(productData).subscribe({
          next: () => {
            this.visible = false;
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
