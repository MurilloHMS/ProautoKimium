import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { Customer } from '../../../../domain/models/customer.model';
import { CustomerService } from '../../../../infrastructure/services/partners/customer/customer.service';
import { CheckboxModule } from 'primeng/checkbox';
import { FileUpload } from "primeng/fileupload";
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
    selector: 'app-customer',
    imports: [TableModule, CommonModule, ButtonModule, ToolbarModule, ToastModule,
    DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule, FileUpload],
    templateUrl: './customer.component.html',
    styleUrl: './customer.component.scss',
    providers: [MessageService]
})
export class CustomerComponent {
  customers: Customer[] = [];
  loading: boolean = false;
  visible: boolean = false;
  customer: Customer | null = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Cliente';
  customerToEdit: Customer | null = null;
  isUploading: boolean = false;
  selectedFile: File | null = null;

  constructor(private customerService: CustomerService,
    private messageService: MessageService,
    private fb: FormBuilder){
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

  editCustomer(customer: Customer) {
    this.dialogTitle = 'Editar Cliente';
    this.customerToEdit = customer;

    this.form.patchValue({
      codParceiro: customer.codParceiro,
      documento: customer.documento,
      nome: customer.nome,
      email: customer.email,
      ativo: customer.ativo,
      recebeEmail: customer.recebeEmail,
      codMatriz: customer.codMatriz ?? null
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

  importByExcel() {
    if (!this.selectedFile) return;

    this.loading = true;
    this.isUploading = true;

    this.customerService.importCustomersByExcel(this.selectedFile).subscribe({
      next: (msg: string) => {
        this.loading = false;
        this.isUploading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: msg
        });
      },
      error: (err) => {
        this.loading = false;
        this.isUploading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: err.error || err.message || 'Erro desconhecido'
        });
      }
    });
  }


  onFileSelect(event: any) {
    this.selectedFile = event.files[0];
  }

}
