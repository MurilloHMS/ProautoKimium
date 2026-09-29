import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeDocumentService } from '../../../infrastructure/services/hr/employee-document.service';
import {
  DOCUMENT_STATUS_INFO,
  EmployeeDocument,
  EmployeeDocumentStatus,
  describeDue,
} from '../../../domain/models/hr/employee-document.model';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

@Component({
  selector: 'app-hr-documents',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './hr-documents.component.html',
  styleUrl: './hr-documents.component.scss',
})
export class HrDocumentsComponent implements OnInit {
  documents = signal<EmployeeDocument[]>([]);
  loading = signal(true);
  erro = signal(false);
  baixandoId = signal<string | null>(null);

  readonly statusInfo = DOCUMENT_STATUS_INFO;
  readonly describeDue = describeDue;

  /** Os que valem hoje. Os substituídos ficam dobrados em "Anteriores": são histórico. */
  readonly current = computed(() => this.documents().filter(doc => doc.status !== 'REPLACED'));
  readonly previous = computed(() => this.documents().filter(doc => doc.status === 'REPLACED'));

  constructor(private service: EmployeeDocumentService) {}

  ngOnInit(): void {
    this.service.getMine().subscribe({
      next: (data) => {
        this.documents.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: EmployeeDocumentStatus): string {
    return DOCUMENT_STATUS_INFO[status].label;
  }

  statusIcon(status: EmployeeDocumentStatus): string {
    return DOCUMENT_STATUS_INFO[status].icon;
  }

  statusClass(status: EmployeeDocumentStatus): string {
    return `status-chip status-chip--${DOCUMENT_STATUS_INFO[status].severity}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  baixar(doc: EmployeeDocument): void {
    this.baixandoId.set(doc.id);
    this.service.download(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.originalFilename || doc.title;
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoId.set(null);
      },
      error: () => this.baixandoId.set(null),
    });
  }
}
