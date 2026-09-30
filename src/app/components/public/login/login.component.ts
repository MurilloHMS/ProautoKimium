import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { AuthService } from '../../../infrastructure/services/auth.service';
import { BiometricError, BiometricLoginService, RememberedDevice } from '../../../infrastructure/services/auth/biometric-login.service';
import { LoginLayoutComponent } from '../../../layouts/login-layout/login-layout.component';
import { PARAM_SESSAO_EXPIRADA } from '../../../infrastructure/interceptors/auth-interceptor';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgxMaskDirective, LoginLayoutComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  providers: [provideNgxMask()],
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  errorMessage = '';
  loading = false;
  identifierMask = '';

  protected readonly biometric = inject(BiometricLoginService);

  /**
   * Quem ativou a digital NESTE aparelho. Existindo, o login começa por ela e
   * a senha fica a um toque (mockup aprovado, 2026-09-30); não existindo, a
   * tela é a de sempre.
   */
  protected readonly device = signal<RememberedDevice | null>(this.biometric.remembered());
  protected readonly usingPassword = signal(this.device() === null);
  protected readonly biometricBusy = signal(false);
  protected readonly biometricError = signal('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    // **O login nao julga o formato da senha, so exige que exista.**
    //
    // Havia aqui a mesma regra de complexidade do primeiro acesso, e ela
    // trancava gente do lado de fora sem recurso: com o botao desabilitado, a
    // pessoa nao consegue nem TENTAR, e o servidor — que e quem sabe se a senha
    // esta certa — nunca e consultado. A saida era pedir a um admin para
    // redefinir.
    //
    // Ficam de fora dessa regra mais pessoas do que parece: quem definiu a
    // senha antes de a regra existir, quem teve a senha definida por um admin,
    // e quem veio pelo portal do cliente, cujas telas nao validam formato.
    //
    // Complexidade se exige na hora de CRIAR a senha — primeiro acesso e
    // redefinicao —, onde a pessoa ainda pode escolher outra. No login, a unica
    // pergunta e se a senha confere, e quem responde e a API.
    this.form = this.fb.group({
      username: [this.device()?.login ?? '', [Validators.required]],
      password: ['', [Validators.required]]
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

  /** O aparelho lembrado pode ter perdido o leitor (desligou a digital no sistema): volta a senha. */
  async ngOnInit(): Promise<void> {
    if (this.device() && !(await this.biometric.available())) {
      this.usingPassword.set(true);
    }
  }

  onIdentifierInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const digits = value.replace(/\D/g, '');
    this.identifierMask = digits.length > 0 && digits.length === value.replace(/[.\-]/g, '').length
      ? '000.000.000-00' : '';
  }

  /** "Entrar com a digital". A recusa mostra a senha já aberta, com o login preenchido. */
  async signInWithBiometrics(): Promise<void> {
    if (this.biometricBusy()) return;
    this.biometricBusy.set(true);
    this.biometricError.set('');
    try {
      await this.biometric.signIn();
      this.enter();
    } catch (e) {
      this.biometricError.set(e instanceof BiometricError ? e.message : 'Não deu para entrar. Tente com a senha.');
      this.usingPassword.set(true);
    } finally {
      this.biometricBusy.set(false);
    }
  }

  usePassword(): void {
    this.biometricError.set('');
    this.usingPassword.set(true);
  }

  /** "Não é você?": este aparelho esquece quem ativou, e a tela volta a ser a de sempre. */
  otherAccount(): void {
    this.biometric.forget();
    this.device.set(null);
    this.biometricError.set('');
    this.form.reset({ username: '', password: '' });
    this.usingPassword.set(true);
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  login(){
    if(this.form.invalid) return;

    this.loading = true;
    const {username, password} = this.form.value;
    this.authService.login(username.toLowerCase(), password).subscribe({
      next: () => {
        this.loading = false;
        // Entrou pela senha: o sistema oferece a digital uma vez, lá dentro.
        const login = this.authService.getUsername();
        if (login) this.biometric.markInvite(login);
        this.enter();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.status === 403
          ? (err.error?.message ?? 'Acesso bloqueado. Entre em contato com o RH.')
          : 'CPF, e-mail ou senha inválidos';
      }
    });
  }

  /**
   * A credencial é válida, mas esta é a entrada do sistema interno. Um cliente
   * que entrasse aqui veria todas as telas que não declaram role. A sessão é
   * descartada na hora e ele vai para o portal dele — pela senha ou pela digital.
   */
  private enter(): void {
    if (this.authService.getUserRoles().includes('CLIENTE')) {
      this.authService.logout();
      this.router.navigate(['/cliente/login']);
      return;
    }
    this.router.navigate(['/home']);
  }
}
