import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from './../../../infrastructure/services/auth.service';
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { UserRole, RegisterDTO, UserResponseDTO } from '../../../domain/models/user.model';

// ── Componentes do tema ProautoKimium ────────────────────────────────────────
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkPasswordComponent } from '../../theme/ProautoKimium/pk-password/pk-password.component';
import { PkMultiselectComponent } from '../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { PkDialogComponent } from '../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkTableComponent } from '../../theme/ProautoKimium/pk-table/pk-table.component';

@Component({
  selector: 'app-admin-center',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    PkButtonComponent,
    PkInputComponent,
    PkPasswordComponent,
    PkMultiselectComponent,
    PkDialogComponent,
    PkTableComponent
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

  // Controla o modal de criar/editar
  showDialog = false;

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
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      roles: [[], [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  // ── Abertura do modal (criar / editar) ─────────────────────────────────────

  /** Abre o modal em branco para registrar um novo usuário. */
  openCreateDialog(): void {
    this.editingUser = null;
    this.registerForm.get('login')?.enable();
    this.buildRegisterForm();
    this.showDialog = true;
  }

  /** Abre o modal já preenchido para editar as permissões de um usuário. */
  selectUserToEdit(user: UserResponseDTO): void {
    this.editingUser = user;
    this.buildRegisterForm();

    // Na edição só as permissões mudam: login travado; e-mail e senha não se aplicam
    ['email', 'password', 'confirmPassword'].forEach(name => {
      const control = this.registerForm.get(name);
      control?.clearValidators();
      control?.updateValueAndValidity();
    });
    this.registerForm.get('login')?.disable();

    this.registerForm.patchValue({
      login: user.login,
      roles: [...user.roles]
    });

    this.showDialog = true;
  }

  /** Fecha o modal e restaura o formulário ao estado inicial. */
  closeDialog(): void {
    this.showDialog = false;
    this.editingUser = null;
    this.registerForm.get('login')?.enable();
    this.buildRegisterForm();
  }

  cancelEdit(): void {
    this.closeDialog();
  }

  /** Fecha e limpa quando o modal é ocultado (X, ESC, clique fora). */
  onDialogVisibleChange(visible: boolean): void {
    if (!visible) this.closeDialog();
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

    const editingLogin = this.editingUser!.login;
    this.authService.updateUserRoles(editingLogin, roles).subscribe({
      next: () => {
        this.editingUser!.roles = [...roles]; // atualiza linha na tabela sem recarregar
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Permissões de "${editingLogin}" atualizadas!` });
        this.isSubmitting = false;
        this.closeDialog();
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
      email: formValue.email,
      password: formValue.password,
      roles: formValue.roles
    };

    this.authService.registerUser(registerData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Usuário registrado com sucesso!' });
        this.closeDialog();
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
      if (field.errors['email']) return 'E-mail inválido';
      if (field.errors['minlength']) return `Mínimo de ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['pattern']) return 'Use apenas letras, números e ponto';
      if (field.errors['passwordMismatch']) return 'As senhas não coincidem';
    }
    return '';
  }
}
