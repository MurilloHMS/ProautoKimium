import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ClientAuthLayoutComponent } from '../../../layouts/client-auth-layout/client-auth-layout.component';
import { ClientAccessService } from '../../../infrastructure/services/client/client-access.service';
import { PASSWORD_RULES, passwordStrengthValidator, passwordsMatchValidator } from '../../../domain/utils/password-rules';

type Stage = 'checking' | 'form' | 'expired' | 'done';

/**
 * Fim do convite: a pessoa clicou no link do e-mail e define a senha.
 *
 * O endereço não é pedido nem mostrado para edição — ele veio no convite e é a
 * API que o usa. Um campo de e-mail aqui daria a impressão de que dá para
 * mudar para onde o acesso vai, e não dá.
 */
@Component({
  selector: 'app-client-first-access',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ClientAuthLayoutComponent],
  templateUrl: './client-first-access.component.html',
})
export class ClientFirstAccessComponent {

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly access = inject(ClientAccessService);

  readonly stage = signal<Stage>('checking');
  readonly errorMessage = signal('');
  readonly saving = signal(false);
  readonly rules = PASSWORD_RULES;

  /** Só para mostrar de quem é o convite; o que vale é o gravado no servidor. */
  readonly email = signal('');

  form: FormGroup;

  /** Confirma para quem é o convite: chegar na tela errada tem que ser óbvio. */
  readonly subtitleFor = computed(() => {
    if (this.stage() === 'done') return '';
    const email = this.email();
    return email
      ? `Este acesso será criado para ${email}.`
      : 'Escolha a senha que você vai usar para entrar no portal.';
  });

  /** Marca cada regra enquanto se digita, sem esperar o envio. */
  readonly password = signal('');
  readonly metRules = computed(() => {
    const value = this.password();
    return this.rules.map(rule => rule.met(value));
  });

  constructor() {
    this.form = this.fb.group({
      password: ['', [Validators.required, passwordStrengthValidator()]],
      confirm: ['', [Validators.required]],
    }, { validators: passwordsMatchValidator() });

    this.form.get('password')!.valueChanges.subscribe(value => this.password.set(value ?? ''));

    const params = this.route.snapshot.queryParamMap;
    this.email.set(params.get('email') ?? '');

    this.check(params.get('token') ?? '');
  }

  private get token(): string {
    return this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  /**
   * Confere o convite antes de mostrar o formulário. Sem isso a pessoa escolhe
   * uma senha, envia e só então descobre que o link tinha vencido.
   */
  private check(token: string): void {
    if (!token) {
      this.stage.set('expired');
      return;
    }

    this.access.inviteIsValid(token).subscribe({
      next: () => this.stage.set('form'),
      error: () => this.stage.set('expired'),
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set('');

    this.access.signIn(this.token, this.form.value.password, this.email()).subscribe({
      next: () => {
        this.saving.set(false);
        this.stage.set('done');
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  private messageFor(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Sem conexão com o servidor. Tente novamente.';
    if (err.status === 409) return 'Este e-mail já tem acesso. Use "Esqueci minha senha" para entrar.';
    if (err.status === 403) return 'Este cliente está inativo. Fale com o seu contato na Proauto Kimium.';
    if (err.status === 400) return 'Convite inválido ou já utilizado. Peça um novo à Proauto Kimium.';
    return 'Não foi possível criar o acesso agora. Tente novamente em alguns minutos.';
  }
}
