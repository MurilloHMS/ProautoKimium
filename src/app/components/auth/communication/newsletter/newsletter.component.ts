import { NewsletterService } from './../../../../infrastructure/services/newsletter/newsletter.service';
import { Component, OnInit } from '@angular/core';
import { Newsletter } from '../../../../domain/models/newsletter.model';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { environment } from '../../../../../environments/environment';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-newsletter',
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    FileUploadModule,
    ToastModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    ConfirmDialogModule,
    ToolbarModule,
    DividerModule,
    BadgeModule,
    ToggleSwitchModule,
    FormsModule
  ],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
  providers: [MessageService, ConfirmationService]
})
export class NewsletterComponent implements OnInit {

  loading = false;
  processing = false;
  newsletters: Newsletter[] = [];
  checked: boolean = false;

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private newsletterService: NewsletterService
  ) { }

  ngOnInit(): void {

  }

  onUpload(event: any) : void {
    const fileList: File[] = event.files;
    this.processing = true;
    this.loading = true;

    if(fileList.length > 0){
      console.log("isMatriz:", this.checked);
      this.newsletterService.createNewsletters(fileList, this.checked).subscribe({
        next: (msg: string) => {
          this.processing = false;
          this.loading = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso',
            detail: msg
          });
        },
        error: (err) => {
          this.loading = false;
          this.processing = false;
          this.messageService.add({
            severity: 'warning',
            summary: 'Error',
            detail: err.error || err.message || 'Erro desconhecido'
          });
        }
      });
    }
  }

  sendPendingNewsletters(): void {
    this.loading = true;
    this.newsletterService.sendPendingNewsletters().subscribe({
      next: (msg: string) => {
        this.processing = false;
        this.loading = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: msg
        });
      },
      error: (err) => {
        this.loading = false;
        this.processing = false;
        this.messageService.add({
          severity: 'warning',
          summary: 'Error',
          detail: err.error || err.message || 'Erro desconhecido'
        });
      }
    });
  }

  loadNewsletters(): void {
     this.loading = true;
    this.http.get<Newsletter[]>(`${environment.apiUrl}/newsletter/pending`).subscribe({
      next: (data) => {
        this.newsletters = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar newsletters:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Erro ao carregar newsletters'
        });
        this.loading = false;
      }
    });
  }

  getStatusSeverity(status: string):
  "success" | "info" | "warn" | "danger" | "secondary" | "contrast" {

  switch (status?.toUpperCase()) {
    case 'SENT':
      return 'success';
    case 'PENDING':
      return 'warn';
    case 'ERROR':
      return 'danger';
    case 'CANCELED':
      return 'info';
    default:
      return 'secondary';
  }
}


  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  formatarData(data: string): string {
    if (!data) return '';
    const date = new Date(data);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

}
