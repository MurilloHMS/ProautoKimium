import { Component, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ɵInternalFormsSharedModule} from '@angular/forms';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

@Component({
    selector: 'app-login',
    imports: [ɵInternalFormsSharedModule, ReactiveFormsModule, RouterLink, NgxMaskDirective],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    encapsulation: ViewEncapsulation.None,
    providers: [provideNgxMask()]
})
export class LoginComponent {
  form: FormGroup;
  errorMessage: string = '';
  loading: boolean = false;
  identifierMask: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ){
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
