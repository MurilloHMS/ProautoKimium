import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpResponse } from '@angular/common/http';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { MessageService } from 'primeng/api';

import { CertificateService } from './../../../infrastructure/services/certificate/certificate.service';
import { Certificate } from '../../../domain/models/certificate.model';
import { Toast } from 'primeng/toast';
import { ApiError } from '../../../domain/models/apiError.models';

@Component({
  selector: 'app-sales-certificates',
  standalone: true,
  imports: [ReactiveFormsModule, NgxMaskDirective, Toast],
  templateUrl: './sales-certificates.component.html',
  styleUrl: './sales-certificates.component.scss',
  providers: [provideNgxMask(), MessageService]
})
export class SalesCertificatesComponent implements OnInit {

  form: FormGroup;
  type: number | null = null;
  isMobile: boolean = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private certificateService: CertificateService,
    private messageService: MessageService
  ) {
    this.form = this.fb.group({
      nome:    ['', Validators.required],
      email:   ['', [Validators.required, Validators.email]],
      contato: ['', [Validators.required, Validators.pattern('^[0-9]{10,11}$')]]
    });
  }

  ngOnInit(): void {
    this.type = Number(this.route.snapshot.queryParamMap.get('type'));

    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!this.isMobile) {
      this.router.navigate(['/']);
    }
  }

  capitalizeName(event: Event): void {
    const input = event.target as HTMLInputElement;
    const pos   = input.selectionStart ?? 0;
    const value = input.value
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());

    this.form.get("nome")!.setValue(value, { emitEvent: false });
    input.setSelectionRange(pos, pos);
  }

  isValid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.valid && (control.dirty || control.touched);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get filledCount(): number {
    return ['nome', 'email', 'contato']
      .filter(f => this.form.get(f)?.valid)
      .length;
  }

  get progressPct(): number {
    return Math.round((this.filledCount / 3) * 100);
  }

  gerarCertificado(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const certificate: Certificate = {
      ...this.form.value,
      name:      this.capitalize(this.form.value.nome).trim(),
      email:     this.form.value.email,
      cellphone: this.form.value.contato
    };

    this.certificateService.addCertificate(certificate).subscribe({

      next: (response: HttpResponse<Blob>) => {
        const blob = response.body!;
        const contentDisposition = response.headers.get('content-disposition');

        let fileName = `${certificate.name}.pdf`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/);
          if (match?.[1]) fileName = match[1];
        }

        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary:  'Sucesso',
          detail:   'Certificado gerado com sucesso!'
        });

        this.form.reset();
      },

      error: async (err) => {
        if (err.error instanceof Blob) {
          try {
            const text = await err.error.text();
            const apiError = JSON.parse(text) as ApiError;

            let detail = '';

            switch (apiError.status) {
              case 409:
                detail = 'Já existe um certificado para esses dados.';
                break;

              case 404:
                detail = 'Certificado não encontrado.';
                break;

              case 400:
                detail = apiError.message;
                break;

              default:
                detail = apiError.message || 'Erro inesperado.';
            }

            this.messageService.add({
              severity: 'error',
              summary: `Erro ${apiError.status}`,
              detail: detail
            });

          } catch {
            this.messageService.add({
              severity: 'error',
              summary: 'Erro',
              detail: 'Erro inesperado ao processar resposta do servidor.'
            });
          }
        } else {
          this.messageService.add({
            severity: 'error',
            summary: `Erro ${err.status}`,
            detail: 'Ocorreu um erro ao gerar o certificado.'
          });
        }
      }
    });
  }

  private capitalize(str: string): string {
    return str
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  }
}
