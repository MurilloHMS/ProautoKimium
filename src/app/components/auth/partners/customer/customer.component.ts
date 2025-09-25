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
import { CheckboxModule } from 'primeng/checkbox';

@Component({
    selector: 'app-customer',
    imports: [TableModule, CommonModule, ButtonModule, ToolbarModule,
        DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule
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
  dialogTitle: string = 'Adicionar Cliente';
  customerToEdit: CustomerResponse | null = null;

  constructor(private customerService: CustomerService, private fb: FormBuilder){
    this.form = this.fb.group({
      codParceiro: ['', Validators.required],
      documento: ['', Validators.required],
      nome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ativo: [true, Validators.required],
      recebeEmail: [true, Validators.required],
      codMatriz: ['']
    });
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

  editCustomer(customer: CustomerResponse) {
    this.dialogTitle = 'Editar Cliente';
    this.customerToEdit = customer;

    this.form.patchValue({
      codParceiro: customer.codParceiro,
      documento: customer.documento,
      nome: customer.name,
      email: customer.email.address,
      ativo: customer.ativo,
      recebeEmail: customer.recebeEmail,
      codigoMatriz: customer.codMatriz ?? null
    });
    this.visible = true;
  }

  deleteCustomer(customer: Customer) {
    console.log('Deletar cliente:', customer);
  }
  showDialog() {
    this.dialogTitle = 'Adicionar Cliente';
    this.customerToEdit = null;
    this.form.reset({
      ativo: true,
      recebeEmail: true
    });
    this.visible = true;
  }

  saveCustomer(){
    if(this.form.valid){
      const customer: Customer = this.form.value;

      if(this.customerToEdit){
        this.customerService.updateCustomer(customer).subscribe({
          next: () => {
            this.visible = false;
            this.loadCustomers();
          },
          error: (err) => alert('Erro ao atualizar cliente: ' + err.message)
        });
      } else{
        this.customerService.addCustomer(customer).subscribe({
          next: () =>{
            this.visible = false;
            this.loadCustomers();
          },
          error: (err) => alert('Erro ao adicionar cliente: ' + err.message)
        });
      }
    };
  }
}
