import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LoginLayoutComponent } from '../../../layouts/login-layout/login-layout.component';

@Component({
  selector: 'app-client-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoginLayoutComponent],
  templateUrl: './client-login.component.html',
})
export class ClientLoginComponent {

  form: FormGroup;
  errorMessage = '';
  loading = false;

  constructor(private fb: FormBuilder) {
    // O controle se chamava `username` com padrão alfanumérico, mas o template
    // pedia `email` — o formulário nem chegava a montar. Agora bate com a tela.
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  /** Área do cliente ainda não tem endpoint de autenticação na API. */
  login(): void {
    this.errorMessage = 'A área do cliente ainda não está disponível.';
  }
}
