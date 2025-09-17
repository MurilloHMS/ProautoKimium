import { EmailService } from './../../../../Core/services/email/email.service';
import { Component } from '@angular/core';
import { Email, EmailItem } from '../../../../domain/models/email.model';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';



@Component({
  selector: 'app-email',
  standalone: true,
  imports: [TableModule, CommonModule, ButtonModule,ToolbarModule],
  templateUrl: './email.component.html',
  styleUrl: './email.component.scss'
})
export class EmailComponent {
  emails: EmailItem[] = [];
  loading: boolean = false;

  constructor(private EmailService: EmailService) {}


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

  addEmail() {
    console.log('Deletar email:');
  }
}
