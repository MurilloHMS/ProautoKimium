import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { AuthService } from '../../../infrastructure/services/auth.service';
import { LoginLayoutComponent } from '../../../layouts/login-layout/login-layout.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgxMaskDirective, LoginLayoutComponent],
  templateUrl: './login.component.html',
  providers: [provideNgxMask()],
})
export class LoginComponent {
  form: FormGroup;
  errorMessage = '';
  loading = false;
  identifierMask = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$')]]
    });
  }

  onIdentifierInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const digits = value.replace(/\D/g, '');
    this.identifierMask = digits.length > 0 && digits.length === value.replace(/[.\-]/g, '').length
      ? '000.000.000-00' : '';
  }

  login(){
    if(this.form.invalid) return;

    this.loading = true;
    const {username, password} = this.form.value;
    this.authService.login(username.toLowerCase(), password).subscribe({
      next: () => {
        this.loading = false;

        // A credencial é válida, mas esta é a entrada do sistema interno. Um
        // cliente que entrasse aqui veria todas as telas que não declaram
        // role. A sessão é descartada na hora e ele vai para o portal dele.
        if (this.authService.getUserRoles().includes('CLIENTE')) {
          this.authService.logout();
          this.router.navigate(['/cliente/login']);
          return;
        }

        this.router.navigate(['/home'])
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.status === 403
          ? (err.error?.message ?? 'Acesso bloqueado. Entre em contato com o RH.')
          : 'CPF, e-mail ou senha inválidos';
      }
    });
  }
}
