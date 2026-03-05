import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


// PrimeNG Services
import { MessageService, ConfirmationService } from 'primeng/api';

// PrimeNG Components
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { EditorModule } from 'primeng/editor';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { Select } from "primeng/select";
import {Recipient} from "../../../../domain/models/partnerRecipient.model";
import {CustomerService} from "../../../../infrastructure/services/partners/customer/customer.service";
import {EmployeeService} from "../../../../infrastructure/services/partners/employee/employee.service";
import {forkJoin} from "rxjs";
import {SkeletonModule} from "primeng/skeleton";
import {ScrollerModule} from "primeng/scroller";

export interface EmailForm {
  from: string;
  replyTo: string;
  subject: string;
  body: string;
}

type FilterType = 'all' | 'employees' | 'customer';

@Component({
  selector: 'app-email',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    CheckboxModule,
    EditorModule,
    FileUploadModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    AutoCompleteModule,
    Select,
    SkeletonModule,
    ScrollerModule
],
  templateUrl: './email.component.html',
  styleUrl: './email.component.scss',
  providers: [MessageService, ConfirmationService],
})
export class EmailComponent implements OnInit {
  // ─── Data ─────────────────────────────────────────────────
  allRecipients: Recipient[] = [];
  filteredList: Recipient[] = [];
  selectedRecipients: Recipient[] = [];
  attachments: File[] = [];
  images: File[] = [];

  // ─── UI State ──────────────────────────────────────────────
  activeFilter: FilterType = 'all';
  searchTerm = '';
  allSelected = false;
  isSending = false;
  showPreview = false;

  totalCounts = { all: 0, employees: 0, clients: 0 };

  // ─── Form ──────────────────────────────────────────────────
  emailForm: EmailForm = {
    from: '',
    replyTo: '',
    subject: '',
    body: '',
  };

  fromEmailOptions: { label: string; value: string }[] = [
    { label: 'noreply@empresa.com.br', value: 'noreply@empresa.com.br' },
    { label: 'marketing@empresa.com.br', value: 'marketing@empresa.com.br' },
    { label: 'contato@empresa.com.br', value: 'contato@empresa.com.br' },
  ];

  constructor(
    private http: HttpClient,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private customerService: CustomerService,
    private employeeService: EmployeeService
  ) {}

  ngOnInit(): void {
    this.loadRecipients();
  }

  // ─── Load Data ────────────────────────────────────────────
  private loadRecipients(): void {
    forkJoin({
      customers: this.customerService.getCustomersEmail(),
      employees: this.employeeService.getEmployeeEmail()
    }).subscribe({
      next: ({ customers, employees }) => {
        const mappedCustomers = (customers ?? []).map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          type: 'customer' as const
        }));

        const mappedEmployees = (employees ?? []).map(e => ({
          id: e.id,
          name: e.name,
          email: e.email,
          type: 'employee' as const
        }));

        this.allRecipients = [...mappedCustomers, ...mappedEmployees];
        this.updateCounts();
        this.applyFilter();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Não foi possível carregar os destinatários.',
        });
      }
    });
  }

  private updateCounts(): void {
    this.totalCounts = {
      all: this.allRecipients.length,
      employees: this.allRecipients.filter(r => r.type === 'employee').length,
      clients: this.allRecipients.filter(r => r.type === 'customer').length,
    };
  }

  // ─── Filtering ───────────────────────────────────────────
  setFilter(filter: FilterType): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  onSearch(): void {
    this.applyFilter();
  }

  private applyFilter(): void {
    let result = this.allRecipients;

    if (this.activeFilter === 'employees') {
      result = result.filter(r => r.type === 'employee');
    } else if (this.activeFilter === 'customer') {
      result = result.filter(r => r.type === 'customer');
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(
        r => r.email.toLowerCase().includes(term) || r.name.toLowerCase().includes(term),
      );
    }

    this.filteredList = result;
    this.updateAllSelectedState();
  }

  // ─── Selection ───────────────────────────────────────────
  isSelected(recipient: Recipient): boolean {
    return this.selectedRecipients.some(r => r.id === recipient.id);
  }

  toggleRecipient(recipient: Recipient): void {
    const idx = this.selectedRecipients.findIndex(r => r.id === recipient.id);
    if (idx >= 0) {
      this.selectedRecipients.splice(idx, 1);
    } else {
      this.selectedRecipients.push(recipient);
    }
    this.selectedRecipients = [...this.selectedRecipients];
    this.updateAllSelectedState();
  }

  toggleSelectAll(event: any): void {
    if (event.checked) {
      const toAdd = this.filteredList.filter(r => !this.isSelected(r));
      this.selectedRecipients = [...this.selectedRecipients, ...toAdd];
    } else {
      const filteredIds = new Set(this.filteredList.map(r => r.id));
      this.selectedRecipients = this.selectedRecipients.filter(r => !filteredIds.has(r.id));
    }
    this.selectedRecipients = [...this.selectedRecipients];
  }

  clearSelection(): void {
    this.selectedRecipients = [];
    this.allSelected = false;
  }

  private updateAllSelectedState(): void {
    if (this.filteredList.length === 0) {
      this.allSelected = false;
      return;
    }
    this.allSelected = this.filteredList.every(r => this.isSelected(r));
  }

  // ─── File Handling ────────────────────────────────────────
  onImagesSelected(event: any): void {
    this.images = [...this.images, ...event.files];
  }

  onImageRemoved(event: any): void {
    this.images = this.images.filter(f => f.name !== event.file.name);
  }

  onAttachmentsSelected(event: any): void {
    this.attachments = [...this.attachments, ...event.files];
  }

  onAttachmentRemoved(event: any): void {
    this.attachments = this.attachments.filter(f => f.name !== event.file.name);
  }

  removeAttachment(index: number): void {
    this.attachments.splice(index, 1);
    this.attachments = [...this.attachments];
  }

  getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      pdf: 'pi-file-pdf',
      doc: 'pi-file-word',
      docx: 'pi-file-word',
      xls: 'pi-file-excel',
      xlsx: 'pi-file-excel',
      png: 'pi-image',
      jpg: 'pi-image',
      jpeg: 'pi-image',
      zip: 'pi-box',
      rar: 'pi-box',
    };
    return icons[ext ?? ''] ?? 'pi-file';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─── Preview & Send ───────────────────────────────────────
  previewEmail(): void {
    this.showPreview = true;
  }

  sendEmails(): void {
    this.confirmationService.confirm({
      header: 'Confirmar Disparo',
      message: `Você está prestes a enviar um e-mail para ${this.selectedRecipients.length} destinatários. Deseja continuar?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim, disparar',
      rejectLabel: 'Cancelar',
      accept: () => this.executeSend(),
    });
  }

  confirmSend(): void {
    this.showPreview = false;
    this.executeSend();
  }

  private executeSend(): void {
    this.isSending = true;

    const formData = new FormData();
    formData.append('from', this.emailForm.from);
    formData.append('replyTo', this.emailForm.replyTo);
    formData.append('subject', this.emailForm.subject);
    formData.append('body', this.emailForm.body);
    formData.append('recipients', JSON.stringify(this.selectedRecipients.map(r => r.email)));

    this.images.forEach(img => formData.append('images', img));
    this.attachments.forEach(att => formData.append('attachments', att));

    // Substitua pela URL do seu endpoint:
    this.http.post('/api/email/blast', formData).subscribe({
      next: () => {
        this.isSending = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso!',
          detail: `E-mail disparado para ${this.selectedRecipients.length} destinatários.`,
          life: 5000,
        });
        this.resetForm();
        this.clearSelection();
      },
      error: (err) => {
        this.isSending = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Erro no disparo',
          detail: err?.error?.message ?? 'Ocorreu um erro ao enviar os e-mails.',
          life: 6000,
        });
      },
    });
  }

  // ─── Reset ────────────────────────────────────────────────
  resetForm(): void {
    this.emailForm = { from: '', replyTo: '', subject: '', body: '' };
    this.attachments = [];
    this.images = [];
  }

  // ─── Helpers ──────────────────────────────────────────────
  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }

  trackById(_index: number, item: Recipient): string | number {
    return item.id;
  }
}
