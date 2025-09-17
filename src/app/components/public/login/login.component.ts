import { Component, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ɵInternalFormsSharedModule} from '@angular/forms';
import { AuthService } from '../../../Core/services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ɵInternalFormsSharedModule, CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class LoginComponent {
  form: FormGroup;
  errorMessage: string = '';

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

    const {username, password} = this.form.value;
    this.authService.login(username, password).subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => this.errorMessage = 'Usuário ou senha inválidos'
    });
  }
}
