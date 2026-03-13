import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from './../../../infrastructure/services/auth.service';
import {Component, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { UserRole, RegisterDTO, UserResponseDTO } from '../../../domain/models/user.model';

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
    TagModule,
    TooltipModule
  ],
  templateUrl: './admin-center.component.html',
  styleUrl: './admin-center.component.scss',
  providers: [MessageService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AdminCenterComponent {
  loading = false;
  registerForm!: FormGroup;
  isSubmitting = false;
  isLoadingUsers = false;
  users: UserResponseDTO[] = [];

  // Controla se estamos editando um usuário existente
  editingUser: UserResponseDTO | null = null;

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

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private fb: FormBuilder
  ) {
    this.buildRegisterForm();
  }

  private buildRegisterForm(): void {
    this.registerForm = this.fb.group({
      login: ['', [Validators.required, Validators.minLength(3), Validators.pattern('^[a-zA-Z0-9.]+$')]],
      password: [''],
      confirmPassword: [''],
      roles: [[], [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  // ── Seleção de usuário na tabela ──────────────────────────────────────────

  selectUserToEdit(user: UserResponseDTO): void {
    this.editingUser = user;

    // Remove validações de senha no modo edição
    this.registerForm.get('password')?.clearValidators();
    this.registerForm.get('confirmPassword')?.clearValidators();
    this.registerForm.get('login')?.disable();

    this.registerForm.patchValue({
      login: user.login,
      password: '',
      confirmPassword: '',
      roles: [...user.roles]
    });

    this.registerForm.get('password')?.updateValueAndValidity();
    this.registerForm.get('confirmPassword')?.updateValueAndValidity();

    // Scroll suave até o formulário
    document.querySelector('.form-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingUser = null;
    this.registerForm.get('login')?.enable();
    this.buildRegisterForm();
  }

  // ── Submit: cria ou atualiza ──────────────────────────────────────────────

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Por favor, corrija os erros no formulário.' });
      return;
    }

    if (this.editingUser) {
      this.updateRoles();
    } else {
      this.registerNewUser();
    }
  }

  private updateRoles(): void {
    this.isSubmitting = true;
    const roles: string[] = this.registerForm.get('roles')?.value;

    this.authService.updateUserRoles(this.editingUser!.login, roles).subscribe({
      next: () => {
        this.editingUser!.roles = [...roles]; // atualiza linha na tabela sem recarregar
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Permissões de "${this.editingUser!.login}" atualizadas!` });
        this.isSubmitting = false;
        this.cancelEdit();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao atualizar permissões.' });
      }
    });
  }

  private registerNewUser(): void {
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
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Usuário registrado com sucesso!' });
        this.registerForm.reset({ roles: [] });
        this.loadUsers();
      },
      error: (error) => {
        this.isSubmitting = false;
        let errorMsg = 'Erro ao registrar usuário';
        if (error.status === 400) errorMsg = 'Usuário já existe';
        else if (error.error?.message) errorMsg = error.error.message;
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: errorMsg });
      }
    });
  }

  // ── Outros ───────────────────────────────────────────────────────────────

  generateAccessTokens(): void {
    this.loading = true;
    this.authService.getStockControlToken().subscribe(token => {
      navigator.clipboard.writeText(token);
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Token copiado para o clipboard!' });
      this.loading = false;
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.authService.getUsers().subscribe({
      next: (users) => { this.users = users; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password?.value && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  getRoleSeverity(role: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" {
    switch (role) {
      case 'ADMIN': return 'danger';
      case 'MANAGER': return 'warn';
      case 'USER': return 'info';
      default: return 'secondary';
    }
  }

  getRoleLabel(role: string): string {
    return this.availableRoles.find(r => r.value === role)?.label ?? role;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'Este campo é obrigatório';
      if (field.errors['minlength']) return `Mínimo de ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['passwordMismatch']) return 'As senhas não coincidem';
    }
    return '';
  }
}
