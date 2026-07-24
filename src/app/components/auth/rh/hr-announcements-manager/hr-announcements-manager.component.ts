import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { AnnouncementService } from '../../../../infrastructure/services/hr/announcement.service';
import { Announcement } from '../../../../domain/models/hr/announcement.model';

@Component({
  selector: 'app-hr-announcements-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Toast, PkButtonComponent, PkInputComponent],
  templateUrl: './hr-announcements-manager.component.html',
  styleUrl: './hr-announcements-manager.component.scss',
  providers: [MessageService],
})
export class HrAnnouncementsManagerComponent implements OnInit {
  announcements: Announcement[] = [];
  loading = false;
  publishing = false;

  form: FormGroup;

  constructor(
    private announcementService: AnnouncementService,
    private fb: FormBuilder,
    private msgService: MessageService
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      content: ['', [Validators.required, Validators.maxLength(4000)]],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.announcementService.getAll().subscribe({
      next: (list) => {
        this.announcements = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  publish(): void {
    if (!this.form.valid) return;

    this.publishing = true;
    const { title, content } = this.form.value;

    this.announcementService.publish({ title: (title as string).trim(), content: (content as string).trim() }).subscribe({
      next: () => {
        this.publishing = false;
        this.form.reset({ title: '', content: '' });
        this.load();
        this.msgService.add({ severity: 'success', summary: 'Sucesso', detail: 'Aviso publicado e funcionários notificados!' });
      },
      error: (err) => {
        this.publishing = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
