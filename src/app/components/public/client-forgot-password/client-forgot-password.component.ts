import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ClientAuthLayoutComponent } from '../../../layouts/client-auth-layout/client-auth-layout.component';
import { ClientAccessService } from '../../../infrastructure/services/client/client-access.service';

/**
 * Pedido de recuperação de senha do portal.
 *
 * A tela diz a mesma coisa em qualquer caso, inclusive quando a conta não
 * existe — e o erro de rede é o único que ela mostra. Responder "não achei
 * esse CNPJ" transformaria a tela num verificador de quem é cliente da
 * Proauto, e CNPJ é dado público: dá para varrer.
 */
@Component({
  selector: 'app-client-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ClientAuthLayoutComponent],
  templateUrl: './client-forgot-password.component.html',
})
export class ClientForgotPasswordComponent {

  private readonly fb = inject(FormBuilder);
  private readonly access = inject(ClientAccessService);

  readonly sent = signal(false);
  readonly sending = signal(false);
  readonly errorMessage = signal('');

  readonly form: FormGroup = this.fb.group({
    login: ['', [Validators.required, Validators.minLength(3)]],
  });

  submit(): void {
    if (this.form.invalid || this.sending()) return;

    this.sending.set(true);
    this.errorMessage.set('');

    this.access.forgotPassword(String(this.form.value.login).trim()).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.sending.set(false);

        // Só a falha de rede aparece. Qualquer outra resposta do servidor vira
        // a mesma confirmação, para não distinguir conta existente de ausente.
        if (err?.status === 0) {
          this.errorMessage.set('Sem conexão com o servidor. Tente novamente.');
          return;
        }
        this.sent.set(true);
      },
    });
  }
}
