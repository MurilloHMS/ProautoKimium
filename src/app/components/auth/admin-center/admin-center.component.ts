import { CommonModule } from '@angular/common';
import { Form, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from './../../../infrastructure/services/auth.service';
import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import {  UserRole, RegisterDTO, UserResponseDTO } from '../../../domain/models/user.model';

@Component({
    selector: 'app-admin-center',
    imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MultiSelectModule,
    ToastModule,
    TableModule,
    TagModule
],
    templateUrl: './admin-center.component.html',
    styleUrl: './admin-center.component.scss',
    providers: [MessageService]
})
export class AdminCenterComponent {
  loading: boolean = false;
  visible: boolean = false;
  registerForm!: FormGroup;
  isSubmitting: boolean = false;
  isLoadingUsers: boolean = false;
  users: UserResponseDTO[] = [];

  availableRoles: UserRole[] = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Usuário', value: 'USER' },
    { label: 'RH', value: 'RH' },
    { label: 'Desenvolvedor', value: 'DEVELOPER' },
    { label: 'Vendedor', value: 'VENDEDOR' },
    { label: 'Administrativo', value: 'ADMINISTRATIVO' },
    { label: 'Financeiro', value: 'FINANCEIRO' },
    { label: 'Design', value: 'DESIGN' },
    { label: 'Marketing', value: 'MARKETING' },
    { label: 'Controladoria', value: 'CONTRATOS' },
    { label: 'Cliente', value: 'CLIENTE' },
    { label: 'Parceiro', value: 'PARCEIRO' },
    { label: 'Técnico', value: 'TECNICO' },
    { label: 'Comprador', value: 'COMPRADOR' },
    { label: 'Manutenção', value: 'MANUTENCAO' },
    { label: 'Produção', value: 'PRODUCAO' },
    { label: 'Almoxarifado', value: 'ALMOXARIFADO' }
  ];


  constructor(private authService: AuthService,
              private messageService: MessageService,
              private fb: FormBuilder
  ) {
    this.registerForm = this.fb.group({
      login: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      roles: [[], [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  generateAccessTokens() {
    this.loading = true;
    this.authService.getStockControlToken().subscribe(token => {
      navigator.clipboard.writeText(token);
      this.messageService.add({severity:'success', summary: 'Success', detail: 'Token copiado para o clipboard!'});
      this.loading = false;
    })
  }

  showDialog(){
    this.visible = true;
  }

  loadUsers(){
    this.loading = true;
    this.authService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading users', err);
        this.loading = false;
      }
    });

  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(){
    if(this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      this.messageService.add({severity:'error', summary: 'Error', detail: 'Por favor, corrija os erros no formulário.'});
      return;
    }

    this.isSubmitting = true;
    const formValue = this.registerForm.value;
    const registerData: RegisterDTO = {
      login: formValue.login,
      password: formValue.password,
      roles: formValue.roles
    };

    this.authService.registerUser(registerData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.messageService.add({severity:'success', summary: 'Success', detail: 'Usuário registrado com sucesso!'});
        this.registerForm.reset();
        this.visible = false;
      },
      error: (error) => {
          this.isSubmitting = false;
          let errorMsg = 'Erro ao registrar usuário';

          if (error.status === 400) {
            errorMsg = 'Usuário já existe';
          } else if (error.error?.message) {
            errorMsg = error.error.message;
          }

          this.messageService.add({
            severity: 'error',
            summary: 'Erro',
            detail: errorMsg
          });
        }
      });
    }

  getRoleSeverity(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'danger';
      case 'MANAGER':
        return 'warning';
      case 'USER':
        return 'info';
      default:
        return 'secondary';
    }
  }

  getRoleLabel(role: string): string {
    const roleObj = this.availableRoles.find(r => r.value === role);
    return roleObj ? roleObj.label : role;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);

    if (field?.errors) {
      if (field.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (field.errors['minlength']) {
        const minLength = field.errors['minlength'].requiredLength;
        return `Mínimo de ${minLength} caracteres`;
      }
      if (field.errors['passwordMismatch']) {
        return 'As senhas não coincidem';
      }
    }

    return '';
  }
}
