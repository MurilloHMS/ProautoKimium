import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { AuthService } from '../../../infrastructure/services/auth.service';
import { LoginLayoutComponent } from '../../../layouts/login-layout/login-layout.component';
import { PARAM_SESSAO_EXPIRADA } from '../../../infrastructure/interceptors/auth-interceptor';

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
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$')]]
    });

  /**
   * A sessão caiu sozinha e o interceptor trouxe a pessoa para cá.
   *
   * A explicação mora aqui e não numa notificação porque a navegação destrói a
   * tela onde o erro aconteceu — qualquer aviso disparado de lá sumiria junto,
   * ou nem chegaria a aparecer.
   */
    if (this.route.snapshot.queryParamMap.has(PARAM_SESSAO_EXPIRADA)) {
      this.errorMessage = 'Sua sessão expirou. Entre novamente para continuar.';
    }
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
