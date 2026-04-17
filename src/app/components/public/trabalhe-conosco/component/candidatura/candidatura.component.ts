import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { NgIf } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';
import { InputText } from 'primeng/inputtext';

import { ResponseVagaDTO } from '../../../../../domain/models/vaga.model';
import { CreateCandidaturaDTO } from '../../../../../domain/models/candidatura.model';
import { CandidaturaService } from '../../../../../infrastructure/services/processoSeletivo/candidatura/candidatura.service';

type FormStep = 'form' | 'sucesso' | 'erro';

@Component({
  selector: 'app-candidatura',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputText,
    NgIf,
  ],
  templateUrl: './candidatura.component.html',
  styleUrl: './candidatura.component.scss',
})
export class CandidaturaComponent implements OnInit, OnChanges, OnDestroy {
  @Input() vaga: ResponseVagaDTO | null = null;
  @Output() fechar = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  form!: FormGroup;
  step: FormStep = 'form';
  enviando = false;
  erroMsg = '';

  curriculoFile: File | null = null;
  curriculoErro = '';

  constructor(
    private fb: FormBuilder,
    private candidaturaService: CandidaturaService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vaga'] && this.form) {
      this.resetar();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefone: ['', [Validators.required, Validators.minLength(10)]],
      urlLinkedin: ['', [Validators.pattern(/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/)]],
    });
  }

  onTelefoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);

    let masked = digits;

    if (digits.length > 2) {
      masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length > 7) {
      masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    input.value = masked;
    this.form.get('telefone')?.setValue(digits, { emitEvent: false });
  }

  enviar(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || !this.vaga || this.enviando) {
      return;
    }

    this.enviando = true;

    const dto: CreateCandidaturaDTO = {
      vagaID: this.vaga.id,
      nome: this.form.value.nome.trim(),
      email: this.form.value.email.trim().toLowerCase(),
      telefone: this.form.value.telefone,
      urlLinkedin: this.form.value.urlLinkedin?.trim() ?? '',
    };

    this.candidaturaService
      .criar(dto, this.curriculoFile ?? undefined)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => {
          this.step = 'sucesso';
        },
        error: (err) => {
          this.erroMsg = err?.error ?? 'Ocorreu um erro ao enviar a candidatura.';
          this.step = 'erro';
        },
      });
  }

  onCurriculoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.curriculoErro = '';

    if (!file) {
      this.curriculoFile = null;
      return;
    }

    const tiposPermitidos = ['application/pdf'];
    const maxSize = 10 * 1024 * 1024;

    if (!tiposPermitidos.includes(file.type)) {
      this.curriculoErro = 'Apenas arquivos PDF são aceitos.';
      this.curriculoFile = null;
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      this.curriculoErro = 'O arquivo não pode ultrapassar 10MB.';
      this.curriculoFile = null;
      input.value = '';
      return;
    }

    this.curriculoFile = file;
  }

  resetar(): void {
    this.step = 'form';
    this.erroMsg = '';
    this.enviando = false;
    this.curriculoFile = null;
    this.curriculoErro = '';
    this.form?.reset();
  }

  onFechar(): void {
    this.fechar.emit();
  }

  invalid(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control?.invalid && control?.touched);
  }

  errocampo(campo: string): string {
    const control = this.form.get(campo);

    if (!control?.errors) return '';
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['email']) return 'E-mail inválido.';
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    }
    if (control.errors['pattern']) return 'URL do LinkedIn inválida.';

    return 'Valor inválido.';
  }
}
