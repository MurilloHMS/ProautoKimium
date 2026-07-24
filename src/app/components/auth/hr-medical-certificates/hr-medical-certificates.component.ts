import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { MedicalCertificateService } from '../../../infrastructure/services/hr/medical-certificate.service';
import { MedicalCertificate, SubmissionType } from '../../../domain/models/hr/medical-certificate.model';

@Component({
  selector: 'app-hr-medical-certificates',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    SelectModule,
    DatePickerModule,
    PkButtonComponent,
    PkCheckboxComponent,
  ],
  templateUrl: './hr-medical-certificates.component.html',
  styleUrl: './hr-medical-certificates.component.scss',
})
export class HrMedicalCertificatesComponent implements OnInit {
  certificates = signal<MedicalCertificate[]>([]);
  loading = signal(true);
  erro = signal(false);
  enviando = signal(false);
  baixandoId = signal<string | null>(null);

  selectedFile: File | null = null;
  legibilityConfirmed = false;

  form: FormGroup;

  submissionTypes = [
    { label: 'Arquivo', value: 'FILE' },
    { label: 'Foto', value: 'PHOTO' },
  ];

  constructor(private service: MedicalCertificateService, private fb: FormBuilder) {
    this.form = this.fb.group({
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      submissionType: ['FILE', Validators.required],
    });
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.service.getMine().subscribe({
      next: (data) => {
        this.certificates.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.loading.set(false);
      },
    });
  }

  get isPhoto(): boolean {
    return this.form.get('submissionType')?.value === 'PHOTO';
  }

  // Toda vez que troca o tipo ou o arquivo, a confirmação de legibilidade precisa
  // ser refeita — não faz sentido carregar a confirmação de uma foto anterior.
  onSubmissionTypeChange(): void {
    this.selectedFile = null;
    this.legibilityConfirmed = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.legibilityConfirmed = false;
  }

  get podeEnviar(): boolean {
    if (this.form.invalid || !this.selectedFile) return false;
    if (this.isPhoto && !this.legibilityConfirmed) return false;
    return true;
  }

  enviar(): void {
    if (!this.podeEnviar || !this.selectedFile) return;

    this.enviando.set(true);
    const { startDate, endDate, submissionType } = this.form.value as {
      startDate: Date;
      endDate: Date;
      submissionType: SubmissionType;
    };

    this.service
      .submit({
        startDate: this.toIsoDate(startDate),
        endDate: this.toIsoDate(endDate),
        submissionType,
        confirmedLegible: submissionType === 'PHOTO' ? true : null,
        file: this.selectedFile,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.selectedFile = null;
          this.legibilityConfirmed = false;
          this.form.reset({ submissionType: 'FILE' });
          this.carregar();
        },
        error: () => this.enviando.set(false),
      });
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  baixar(cert: MedicalCertificate): void {
    this.baixandoId.set(cert.id);
    this.service.download(cert.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cert.originalFilename;
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoId.set(null);
      },
      error: () => this.baixandoId.set(null),
    });
  }
}
