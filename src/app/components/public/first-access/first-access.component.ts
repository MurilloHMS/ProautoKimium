import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { passwordStrengthValidator } from '../../../domain/utils/password-rules';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PasswordModule } from 'primeng/password';
import { InputOtpModule } from 'primeng/inputotp';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { LoginLayoutComponent } from '../../../layouts/login-layout/login-layout.component';
import { AuthStepIndicatorComponent } from '../shared/auth-step-indicator/auth-step-indicator.component';
import { PasswordRulesComponent } from '../shared/password-rules/password-rules.component';

@Component({
  selector: 'app-first-access',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ToastModule,
    PasswordModule,
    InputOtpModule,
    NgxMaskDirective,
    LoginLayoutComponent,
    AuthStepIndicatorComponent,
    PasswordRulesComponent,
  ],
  templateUrl: './first-access.component.html',
  providers: [MessageService, provideNgxMask()]
})
export class FirstAccessComponent implements OnInit, OnDestroy{

  step = 1;
  loading = false;
  resendCooldown = 0;

  requestForm!: FormGroup;
  tokenForm!: FormGroup;
  passwordForm!: FormGroup;

  createdUsername = '';
  private validatedToken = '';
  private lastDocument = '';
  private lastEmail = '';
  private cooldownInterval?: ReturnType<typeof setInterval>;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.requestForm = this.fb.group({
      // A máscara entrega só os dígitos (dropSpecialCharacters padrão do ngx-mask),
      // que é o formato que a API compara em findByCpfDigits.
      document: ['', [Validators.required, Validators.minLength(11)]],
      email: ['', [Validators.required, Validators.email]],
    });

    this.tokenForm = this.fb.group({
      token: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.passwordForm = this.fb.group(
      {
        newPassword: [
          '',
          [
            Validators.required,
            passwordStrengthValidator(),
          ],
        ],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator }
    );

    this.applyDeepLink();
  }

  /**
   * Deep link do e-mail (/first-access?token=...&email=...): pula a identificação
   * e valida o código automaticamente. Só ativa com os dois parâmetros presentes —
   * sem o e-mail não seria possível criar o usuário no passo da senha.
   */
  private applyDeepLink(): void {
    const params = this.route.snapshot.queryParamMap;
    const token = params.get('token');
    const email = params.get('email');
    if (!token || !email) return;

    this.lastEmail = email;
    this.tokenForm.patchValue({ token });
    this.step = 2;

    // Remove os parâmetros da barra de endereço sem recarregar (token não fica visível/na navegação subsequente)
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });

    if (this.tokenForm.valid) {
      this.onValidateToken();
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }

  // ── Step 1: solicitar código ─────────────────────────────────────────────
  onRequestToken(): void {
    if (this.requestForm.invalid) return;
    this.loading = true;

    const document: string = this.requestForm.value.document;
    this.lastDocument = document;
    const email: string = this.requestForm.value.email;
    this.lastEmail = email;

    this.authService.firstAccessGenerateToken(document, email).subscribe({
      next: () => {
        this.loading = false;
        this.step = 2;
        this.startResendCooldown();
        this.messageService.add({
          severity: 'success',
          summary: 'Código enviado',
          detail: 'Verifique seu e-mail.',
          life: 4000,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: err.error ?? 'Não foi possível enviar o código. Tente novamente.',
          life: 5000,
        });
      },
    });
  }

  // ── Step 2: validar código ───────────────────────────────────────────────
  onValidateToken(): void {
    if (this.tokenForm.invalid) return;
    this.loading = true;

    const token: string = this.tokenForm.value.token;

    this.authService.firstAccessValidateToken(token).subscribe({
      next: () => {
        this.loading = false;
        this.validatedToken = token;
        this.step = 3;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.tokenForm.get('token')?.setErrors({ invalidToken: true });
        this.messageService.add({
          severity: 'error',
          summary: 'Código inválido',
          detail: err.status === 400
            ? 'Código inválido ou expirado. Verifique o e-mail ou solicite um novo.'
            : 'Não foi possível validar o código. Tente novamente.',
          life: 5000,
        });
      },
    });
  }

  // ── Step 3: criar usuário ────────────────────────────────────────────────
  onCreateUser(): void {
    if (this.passwordForm.invalid) return;
    this.loading = true;

    const newPassword: string = this.passwordForm.value.newPassword;

    this.authService.firstAccessCreateUsername(this.validatedToken, newPassword, this.lastEmail).subscribe({
      next: (message: string) => {
        this.loading = false;
        this.createdUsername = this.extractUsername(message);
        this.step = 4;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;

        if (err.status === 400) {
          this.step = 2;
          this.tokenForm.reset();
          this.messageService.add({
            severity: 'error',
            summary: 'Código expirado',
            detail: 'O código expirou. Solicite um novo e tente de novo.',
            life: 5000,
          });
          return;
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Erro ao criar o usuário. Tente novamente.',
          life: 5000,
        });
      },
    });
  }

  // ── Reenviar código ──────────────────────────────────────────────────────
  onResend(): void {
    if (this.resendCooldown > 0 || !this.lastDocument) return;

    this.authService.firstAccessGenerateToken(this.lastDocument, this.lastEmail).subscribe({
      next: () => {
        this.startResendCooldown();
        this.messageService.add({
          severity: 'info',
          summary: 'Código reenviado',
          detail: 'Um novo código foi enviado para seu e-mail.',
          life: 4000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Aviso',
          detail: 'Não foi possível reenviar o código.',
          life: 4000,
        });
      },
    });
  }

  goBack(): void {
    if (this.step === 3) {
      this.step = 2;
      this.passwordForm.reset();
      return;
    }
    this.step = 1;
    this.tokenForm.reset();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const pw = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
  }

  private extractUsername(message: string): string {
    const match = message.match(/usuário:\s*(\S+)/i);
    return match ? match[1] : message;
  }

  private startResendCooldown(seconds = 60): void {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    this.resendCooldown = seconds;
    this.cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this.cooldownInterval);
    }, 1000);
  }

  // ── Textos do cabeçalho (o login-layout recebe título e subtítulo por passo) ──
  get stepTitle(): string {
    switch (this.step) {
      case 1:  return 'Primeiro acesso?';
      case 2:  return 'Código de verificação';
      case 3:  return 'Crie sua senha';
      default: return 'Tudo certo!';
    }
  }

  get stepSubtitle(): string {
    switch (this.step) {
      case 1:  return 'Informe seu CPF e e-mail para enviarmos um código de verificação.';
      case 2:  return 'Digite o código de 6 caracteres recebido no seu e-mail.';
      case 3:  return 'Código confirmado! Agora crie a sua senha.';
      default: return '';
    }
  }
}
