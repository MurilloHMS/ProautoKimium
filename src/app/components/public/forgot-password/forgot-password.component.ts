import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { InputOtpModule } from 'primeng/inputotp';
import { AuthService } from '../../../infrastructure/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ToastModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    InputOtpModule,
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [MessageService],
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {

  step = 1;
  loading = false;
  resendCooldown = 0;

  requestForm!: FormGroup;
  tokenForm!: FormGroup;
  passwordForm!: FormGroup;

  private lastLogin = '';
  private validatedToken = '';
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
      username: ['', Validators.required],
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
            Validators.pattern(
              '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$'
            ),
          ],
        ],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator }
    );

    this.applyDeepLink();
  }

  private applyDeepLink(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    this.validatedToken = token;
    this.step = 3;

    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
  }

  // ── Step 1: solicitar código ─────────────────────────────────────────────
  onRequestToken(): void {
    if (this.requestForm.invalid) return;
    this.loading = true;

    const login: string = this.requestForm.value.username;
    this.lastLogin = login;

    this.authService.forgotPassword(login).subscribe({
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

  // ── Step 2: validar código (avança para senha) ───────────────────────────
  onValidateToken(): void {
    if (this.tokenForm.invalid) return;
    this.validatedToken = this.tokenForm.value.token;
    this.step = 3;
  }

  // ── Step 3: redefinir senha ──────────────────────────────────────────────
  onResetPassword(): void {
    if (this.passwordForm.invalid) return;
    this.loading = true;

    const newPassword: string = this.passwordForm.value.newPassword;

    this.authService.resetPassword(this.validatedToken, newPassword).subscribe({
      next: () => {
        this.loading = false;
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
            detail: 'O código expirou. Solicite um novo e tente novamente.',
            life: 5000,
          });
          return;
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Erro ao redefinir senha. Tente novamente.',
          life: 5000,
        });
      },
    });
  }

  // ── Reenviar código ──────────────────────────────────────────────────────
  onResend(): void {
    if (this.resendCooldown > 0 || !this.lastLogin) return;

    this.authService.forgotPassword(this.lastLogin).subscribe({
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

  private startResendCooldown(seconds = 60): void {
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    this.resendCooldown = seconds;
    this.cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this.cooldownInterval);
    }, 1000);
  }

  get passwordChecks() {
    const value: string = this.passwordForm?.get('newPassword')?.value ?? '';
    return {
      lower: /[a-z]/.test(value),
      upper: /[A-Z]/.test(value),
      number: /\d/.test(value),
      special: /[@$!%*?&#]/.test(value),
      minLength: value.length >= 8,
    };
  }
}
