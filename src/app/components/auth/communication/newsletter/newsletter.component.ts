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
    BadgeModule
  ],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
  providers: [MessageService, ConfirmationService]
})
export class NewsletterComponent implements OnInit {

  loading = false;
  processing = false;
  newsletters: Newsletter[] = [];

  constructor(
    private http: HttpClient,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {

  }

  onUpload($event: any) : void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Funcionalidade de exportação em desenvolvimento'
    });
  }

  loadNewsletters(): void {
     this.loading = true;
    this.http.get<Newsletter[]>('').subscribe({
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

  getStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ENVIADO':
        return 'success';
      case 'PENDENTE':
        return 'warning';
      case 'ERRO':
        return 'danger';
      case 'CANCELADO':
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

  exportarExcel(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Funcionalidade de exportação em desenvolvimento'
    });
  }
}
