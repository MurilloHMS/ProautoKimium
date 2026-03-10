import {Component, CUSTOM_ELEMENTS_SCHEMA, OnInit} from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Department, Employee, Hierarchy } from '../../../../domain/models/employee.model';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import {Toast} from "primeng/toast";



@Component({
    selector: 'app-employes',
  imports: [TableModule, CommonModule, ButtonModule, ToolbarModule, SelectModule,
    DialogModule, InputTextModule, ReactiveFormsModule, CheckboxModule, DatePickerModule, Toast],
    templateUrl: './employes.component.html',
    styleUrl: './employes.component.scss',
    providers: [MessageService],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class EmployesComponent{
  employes: Employee[] = [];
  loading: boolean = false;
  visible: boolean = false;
  employee: Employee | null = null;
  form: FormGroup;
  dialogTitle: string = 'Adicionar Funcionário';
  employeToEdit: Employee | null = null;
  hierarchyList: {label: string, value: Hierarchy} [] = []
  departmentList: {label: string, value: Department} [] = []

  constructor(
    private employeService: EmployeeService,
    private fb: FormBuilder,
    private msgService: MessageService
  ){
    this.form = this.fb.group({
      partnerCode: ['', Validators.required],
      document: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ativo: [true, Validators.required],
      managerCode: [''],
      hierarchy: [Hierarchy.ASSISTENTE, Validators.required],
      birthday: [null],
      department: [Department.ALIMENTOS, Validators.required]
    });
  }

  ngOnInit(){
    this.loadHierarchyList();
    this.loadDepartmentList();
  }

  loadHierarchyList(){
    this.hierarchyList = Object.keys(Hierarchy)
      .filter(key => isNaN(Number(key)))
      .map(key => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
        value: Hierarchy[key as keyof typeof Hierarchy]
      }));
  }

  loadDepartmentList(){
    this.departmentList = Object.keys(Department)
      .filter(key => isNaN(Number(key)))
      .map(key => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
        value: Department[key as keyof typeof Department]
      }));
  }

  loadEmployes(){
    this.loading = true;
    this.employeService.getEmployes().subscribe({
      next: (list) => {
        this.employes = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({
          severity: 'warning',
          summary: 'Error',
          detail: err.error || err.message || 'Erro desconhecido'

        });
      }
    });
  }

  editEmploye(employee: Employee){
    this.dialogTitle = 'Editar funcionário';
    this.employeToEdit = employee;

    this.form.patchValue({
      partnerCode: employee.partnerCode,
      document: employee.document,
      name: employee.name,
      email: employee.email,
      ativo: employee.ativo,
      managerCode: employee.managerCode,
      hierarchy: employee.hierarchy,
      birthday: employee.birthday
    });

    this.visible = true;
  }

  showDialog() {
    this.dialogTitle = 'Adicionar Funcionário';
    this.employeToEdit = null;
    this.form.reset({
      ativo: true
    });
    this.visible = true;
  }

  save(){
    if(this.form.valid){
      const employee = this.form.value;
      employee.hierarchy = Hierarchy[employee.hierarchy];
      employee.department = Department[employee.department];

      if(employee.birthday instanceof Date){
        employee.birthday = employee.birthday.toISOString().split('T')[0];
      }
      console.log(employee);
      if(this.employeToEdit){
        this.employeService.updateEmploye(employee).subscribe({
          next: () => {
            this.visible = false;
            this.loadEmployes();
          },
          error: (err) => {
            this.visible = false;
            this.msgService.add({ severity: 'warning', summary: 'Error',detail: err.error || err.message || 'Erro desconhecido'});
          }
        });
      }else {
        this.employeService.addEmploye(employee).subscribe({
          next: () => {
            this.visible = false;
            this.loadEmployes();
          },
          error: (err) => {
            this.visible = false;
            this.msgService.add({
              severity: 'warning',
              summary: 'Error',
              detail: err.error || err.message || 'Erro desconhecido'
            });
          }
        })
      }
    }
  }
}
