import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ClientAuthLayoutComponent } from '../../../layouts/client-auth-layout/client-auth-layout.component';
import { ClientAuthService } from '../../../infrastructure/services/client/client-auth.service';

/**
 * Entrada da Área do Cliente — frame `Login · Acesso` do Figma.
 *
 * Não usa o `app-login-layout` do sistema interno de propósito: aquele é um
 * cartão branco centralizado, e este é outro produto, com identidade própria.
 */
@Component({
  selector: 'app-client-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ClientAuthLayoutComponent],
  templateUrl: './client-login.component.html',
})
export class ClientLoginComponent {

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(ClientAuthService);
  private readonly router = inject(Router);

  form: FormGroup;
  errorMessage = '';
  loading = false;

  constructor() {
    // Um campo só, aceitando e-mail ou CNPJ, como no desenho. A API resolve os
    // dois: 14 dígitos viram busca de cliente, o resto é e-mail ou login.
    this.form = this.fb.group({
      login: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required]],
      remember: [true],
    });
  }

  login(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.errorMessage = '';

    const { login, password, remember } = this.form.value;

    this.auth.login(String(login).trim(), password, !!remember).subscribe({
      next: () => this.router.navigate(['/cliente']),
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.messageFor(err);
      },
    });
  }

  /**
   * Erro de login não diz o que estava errado de propósito: responder "esse
   * CNPJ não existe" conta a quem está tentando adivinhar que os outros
   * existem.
   */
  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Sem conexão com o servidor. Tente novamente.';
    if (err.status === 403) return 'Acesso bloqueado. Fale com o seu contato na Proauto Kimium.';
    if (err.status === 401 || err.status === 400) return 'E-mail, CNPJ ou senha incorretos.';
    return 'Não foi possível entrar agora. Tente novamente em alguns minutos.';
  }
}
