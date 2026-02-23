import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ɵInternalFormsSharedModule} from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-client-login',
  imports: [CommonModule, RouterLink, ReactiveFormsModule, ɵInternalFormsSharedModule],
  templateUrl: './client-login.component.html',
  styleUrl: './client-login.component.scss'
})
export class ClientLoginComponent {
form: FormGroup;
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
  ){
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9.]+$')]],
      password: ['', [Validators.required, Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')]]
    });
  }

  login(){

  }
}
