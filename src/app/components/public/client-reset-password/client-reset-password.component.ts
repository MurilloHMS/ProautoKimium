import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ClientAuthLayoutComponent } from '../../../layouts/client-auth-layout/client-auth-layout.component';
import { ClientAccessService } from '../../../infrastructure/services/client/client-access.service';
import { PASSWORD_RULES, passwordStrengthValidator, passwordsMatchValidator } from '../../../domain/utils/password-rules';

/**
 * Redefinição de senha do portal: código do e-mail mais a senha nova.
 *
 * O código fica num campo visível e não escondido na URL porque o e-mail de
 * recuperação manda um código de 6 caracteres para ser digitado — quem chegou
 * pelo link já encontra o campo preenchido, quem digitou o código à mão também
 * entra por aqui.
 */
@Component({
  selector: 'app-client-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ClientAuthLayoutComponent],
  templateUrl: './client-reset-password.component.html',
})
export class ClientResetPasswordComponent {

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly access = inject(ClientAccessService);

  readonly done = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly rules = PASSWORD_RULES;

  form: FormGroup;

  readonly password = signal('');
  readonly metRules = computed(() => {
    const value = this.password();
    return this.rules.map(rule => rule.met(value));
  });

  constructor() {
    this.form = this.fb.group({
      token: [this.route.snapshot.queryParamMap.get('token') ?? '', [Validators.required]],
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirm: ['', [Validators.required]],
    }, { validators: passwordsMatchValidator() });

    this.form.get('password')!.valueChanges.subscribe(value => this.password.set(value ?? ''));
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set('');

    const { token, password } = this.form.value;

    this.access.resetPassword(String(token).trim(), password).subscribe({
      next: () => {
        this.saving.set(false);
        this.done.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Sem conexão com o servidor. Tente novamente.';
    if (err.status === 400) return 'Código inválido, expirado ou já utilizado. Peça um novo código.';
    return 'Não foi possível redefinir a senha agora. Tente novamente em alguns minutos.';
  }
}
