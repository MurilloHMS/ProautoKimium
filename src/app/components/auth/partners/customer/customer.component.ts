import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { Customer, CustomerResponse } from '../../../../domain/models/customer.model';
import { CustomerService } from '../../../../infrastructure/services/partners/customer/customer.service';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule,
    DialogModule, InputTextModule, ReactiveFormsModule
  ],
  templateUrl: './customer.component.html',
  styleUrl: './customer.component.scss'
})
export class CustomerComponent {
  customers: CustomerResponse[] = [];
  loading: boolean = false;
  visible: boolean = false;
  customer: Customer | null = null;
  form: FormGroup;

  constructor(private customerService: CustomerService, private fb: FormBuilder){
    this.form = this.fb.group({
      codParceiro: ['', Validators.required],
      documento: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ativo: [true, Validators.required],
      recebeEmail: [true, Validators.required],
      codigoMatriz: ['', Validators.required]
    });
      this.loadCustomers();
  }

  loadCustomers(){
    this.loading = true;
    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading customers', err);
        this.loading = false;
      }
    });
  }

  editCustomer(customer: Customer) {
    console.log('Editar cliente:', customer);
  }
  deleteCustomer(customer: Customer) {
    console.log('Deletar cliente:', customer);
  }
  showDialog() {
    this.visible = true;
  }

  addCustomer(){
    if (this.form.valid) {
      const newCustomer: Customer = this.form.value
      this.customerService.addCustomer(newCustomer).subscribe({
        next: (customer) => {
          console.log('Cliente adicionado com sucesso:', customer);
          this.visible = false;
          this.form.reset();
          this.loadCustomers();
        },
        error: (err) => {
          console.error('Erro ao adicionar cliente:', err);
        }
      });
    }
  }


}
