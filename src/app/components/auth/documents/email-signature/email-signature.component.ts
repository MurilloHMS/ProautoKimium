import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { EmailSignatureService } from '../../../../infrastructure/services/emailSignature/email-signature.service';

@Component({
  selector: 'app-email-signature',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './email-signature.component.html',
  styleUrl: './email-signature.component.scss',
})
export class EmailSignatureComponent implements OnDestroy {

  form: FormGroup;
  loading = false;
  previewUrl: SafeUrl | null = null;
  errorMsg = '';

  private currentObjectUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private signatureService: EmailSignatureService
  ) {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      cargo: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      celular: ['', Validators.required],
      whatsapp: ['', Validators.required],
      site: ['www.proautokimium.com.br', Validators.required],
    });
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }


  onNomeInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const pos = input.selectionStart ?? input.value.length;

  const capitalized = input.value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  this.form.get('nome')!.setValue(capitalized, { emitEvent: false });
  input.value = capitalized;

  setTimeout(() => input.setSelectionRange(pos, pos));
}


  private applyPhoneMask(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length > 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length > 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 2) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length > 0) {
      return `(${digits}`;
    }
    return digits;
  }

  onCelularInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masked = this.applyPhoneMask(input.value);
    this.form.get('celular')!.setValue(masked, { emitEvent: false });
    input.value = masked;
  }

  onWhatsappInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masked = this.applyPhoneMask(input.value);
    this.form.get('whatsapp')!.setValue(masked, { emitEvent: false });
    input.value = masked;
  }

  loadPreview(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading = true;
    this.errorMsg = '';

    this.signatureService.preview(this.form.value).subscribe({
      next: (blob) => {
        this.revokeCurrentUrl();
        const url = this.signatureService.blobToObjectUrl(blob);
        this.currentObjectUrl = url;
        this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(url);
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Erro ao gerar preview. Verifique a conexão com a API.';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading = true;
    this.errorMsg = '';

    this.signatureService.generate(this.form.value).subscribe({
      next: (blob) => {
        this.signatureService.downloadBlob(blob);
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Erro ao baixar a assinatura.';
        this.loading = false;
      }
    });
  }

  private revokeCurrentUrl(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.revokeCurrentUrl();
  }

}