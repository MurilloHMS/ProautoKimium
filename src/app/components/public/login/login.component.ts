import { Component, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ɵInternalFormsSharedModule} from '@angular/forms';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { Router } from '@angular/router';
import { Button } from "primeng/button";


@Component({
    selector: 'app-login',
    imports: [ɵInternalFormsSharedModule, ReactiveFormsModule, Button],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class LoginComponent {
  form: FormGroup;
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ){
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
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
      error: () => {
        this.loading = false;
        this.errorMessage = 'Usuário ou senha inválidos'
      }
    });
  }
}
