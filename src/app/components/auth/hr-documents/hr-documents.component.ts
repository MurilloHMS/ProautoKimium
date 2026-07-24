import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeDocumentService } from '../../../infrastructure/services/hr/employee-document.service';
import { EmployeeDocument } from '../../../domain/models/hr/employee-document.model';

@Component({
  selector: 'app-hr-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hr-documents.component.html',
  styleUrl: './hr-documents.component.scss',
})
export class HrDocumentsComponent implements OnInit {
  documents = signal<EmployeeDocument[]>([]);
  loading = signal(true);
  erro = signal(false);
  baixandoId = signal<string | null>(null);

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
        a.download = doc.originalFilename;
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoId.set(null);
      },
      error: () => this.baixandoId.set(null),
    });
  }
}
