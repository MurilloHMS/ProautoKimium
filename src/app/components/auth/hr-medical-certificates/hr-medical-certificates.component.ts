import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkDialogComponent } from '../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { ehCelular } from '../../../infrastructure/state/eh-celular';
import { MedicalCertificateService } from '../../../infrastructure/services/hr/medical-certificate.service';
import { MEDICAL_CERTIFICATE_STATUS_INFO, MedicalCertificate, SubmissionType } from '../../../domain/models/hr/medical-certificate.model';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';
import { formatDateBr, formatStampBr } from '../../../domain/utils/date-only';
import { apiMessage } from '../../../domain/utils/api-error';

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
    PkDialogComponent,
    PkSheetComponent,
    PageHeaderComponent,
  ],
  templateUrl: './hr-medical-certificates.component.html',
  styleUrl: './hr-medical-certificates.component.scss',
})
export class HrMedicalCertificatesComponent implements OnInit {
  certificates = signal<MedicalCertificate[]>([]);
  loading = signal(true);
  erro = signal(false);
  enviando = signal(false);
  /**
   * Por que o envio não saiu. Antes o erro só parava o spinner: a API recusava
   * com motivo ("data final antes da inicial", "valor maior que zero") e a
   * pessoa via o botão voltar ao normal sem saber de nada.
   */
  erroEnvio = signal<string | null>(null);
  baixandoId = signal<string | null>(null);

  selectedFile: File | null = null;
  legibilityConfirmed = false;

  form: FormGroup;

  readonly statusInfo = MEDICAL_CERTIFICATE_STATUS_INFO;
  readonly ehCelular = ehCelular();

  // ---- Reenvio do recusado (2026-10-02) ----
  // O período continua o mesmo: o RH confere o mesmo afastamento com outro arquivo.
  resubmitTarget = signal<MedicalCertificate | null>(null);
  resubmitType: SubmissionType = 'FILE';
  resubmitFile: File | null = null;
  resubmitLegible = false;
  resubmitComment = '';
  resubmitting = signal(false);
  resubmitError = signal<string | null>(null);
  /** Mensagem curta depois do reenvio, no lugar do cartão. */
  resubmitDone = signal<string | null>(null);

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
    this.erroEnvio.set(null);
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
        error: (err) => {
          this.enviando.set(false);
          this.erroEnvio.set(apiMessage(err) ?? 'Não foi possível enviar o atestado. Tente de novo.');
        },
      });
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDate(iso: string): string {
    return formatDateBr(iso);
  }

  formatStamp(iso: string | null): string {
    return iso ? formatStampBr(iso) : '';
  }

  /** Quando chegou o arquivo em vigor — o primeiro envio ou o último reenvio. */
  lastSubmittedAt(cert: MedicalCertificate): string {
    return cert.resubmittedAt ?? cert.submittedAt;
  }

  openResubmit(cert: MedicalCertificate): void {
    this.resubmitTarget.set(cert);
    this.resubmitType = 'FILE';
    this.resubmitFile = null;
    this.resubmitLegible = false;
    this.resubmitComment = '';
    this.resubmitError.set(null);
  }

  closeResubmit(): void {
    if (this.resubmitting()) return;
    this.resubmitTarget.set(null);
  }

  setResubmitType(type: SubmissionType): void {
    this.resubmitType = type;
    this.resubmitFile = null;
    this.resubmitLegible = false;
  }

  onResubmitFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.resubmitFile = input.files?.[0] ?? null;
    this.resubmitLegible = false;
  }

  get canResubmit(): boolean {
    if (!this.resubmitFile) return false;
    return this.resubmitType !== 'PHOTO' || this.resubmitLegible;
  }

  resubmit(): void {
    const target = this.resubmitTarget();
    if (!target || !this.canResubmit || !this.resubmitFile) return;
    this.resubmitting.set(true);
    this.resubmitError.set(null);
    this.service.resubmit(target.id, {
      submissionType: this.resubmitType,
      confirmedLegible: this.resubmitType === 'PHOTO' ? true : null,
      comment: this.resubmitComment.trim() || null,
      file: this.resubmitFile,
    }).subscribe({
      next: () => {
        this.resubmitting.set(false);
        this.resubmitTarget.set(null);
        this.resubmitDone.set('Atestado reenviado. O RH foi avisado e vai conferir de novo.');
        this.carregar();
      },
      error: (err) => {
        this.resubmitting.set(false);
        this.resubmitError.set(apiMessage(err) ?? 'Não foi possível reenviar. Tente de novo.');
      },
    });
  }

  baixar(cert: MedicalCertificate): void {
    this.baixandoId.set(cert.id);
    this.service.download(cert.id).subscribe({
      next: (resp) => {
        this.triggerDownload(resp.body!, cert.originalFilename);
        this.baixandoId.set(null);
      },
      error: () => this.baixandoId.set(null),
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }
}
