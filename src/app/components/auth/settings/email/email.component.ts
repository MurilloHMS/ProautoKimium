import { EmailService } from './../../../../infrastructure/services/email/email.service';
import { Component } from '@angular/core';
import { Email, EmailItem } from '../../../../domain/models/email.model';
import { TableModule } from 'primeng/table';

import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';



@Component({
    selector: 'app-email',
    imports: [TableModule, ButtonModule, ToolbarModule, DialogModule, InputTextModule, ReactiveFormsModule],
    templateUrl: './email.component.html',
    styleUrl: './email.component.scss'
})
export class EmailComponent {
  emails: EmailItem[] = [];
  loading: boolean = false;
  email: Email | null = null;
  visible: boolean = false;
  form: FormGroup;

  constructor(private EmailService: EmailService, private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', Validators.required]
    });
    this.loadEmails();
  }


  loadEmails(){
    this.loading = true;
    this.EmailService.getEmails().subscribe({
      next: (emails) => {
        this.emails = emails;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading emails', err);
        this.loading = false;
      }
    });
  }

  editEmail(email: Email) {
    console.log('Editar email:', email);
  }

  deleteEmail(email: Email) {
    console.log('Deletar email:', email);
  }

  showDialog() {
    this.visible = true;
  }

  addEmail() {
    if(this.form.invalid) return;

    const newEmail: Email = {
      nome: this.form.value.name
    };
    this.EmailService.addEmail(newEmail).subscribe({
      next: () => {
        this.visible = false;
        this.form.reset();
      },
      error: (err) => {
        console.error('Error adding email', err);
      }
    });
  }
}
