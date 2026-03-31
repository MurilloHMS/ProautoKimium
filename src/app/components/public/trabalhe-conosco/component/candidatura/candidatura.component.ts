import {Component, EventEmitter, Input, Output, SimpleChanges} from '@angular/core';
import {ResponseVagaDTO} from "../../../../../domain/models/vaga.model";
import {finalize, Subject, takeUntil} from "rxjs";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {
  CandidaturaService, CreateCandidaturaDTO
} from "../../../../../infrastructure/services/processoSeletivo/candidatura/candidatura.service";
import {InputText} from "primeng/inputtext";
import {NgIf} from "@angular/common";

type FormStep = 'form' | 'sucesso' | 'erro';

@Component({
  selector: 'app-candidatura',
  imports: [
    ReactiveFormsModule,
    InputText,
    NgIf
  ],
  templateUrl: './candidatura.component.html',
  styleUrl: './candidatura.component.scss',
})
export class CandidaturaComponent {

  @Input()  vaga: ResponseVagaDTO | null = null;
  @Output() fechar = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  form!: FormGroup;
  step: FormStep = 'form';
  enviando = false;
  erroMsg = '';

  // Máscara de telefone simples
  telefoneRaw = '';

  constructor(
    private fb: FormBuilder,
    private candidaturaService: CandidaturaService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vaga'] && this.vaga) {
      this.resetar();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      nome:         ['', [Validators.required, Validators.minLength(3)]],
      email:        ['', [Validators.required, Validators.email]],
      telefone:     ['', [Validators.required, Validators.minLength(10)]],
      urlLinkedin:  ['', [Validators.pattern(/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/)]],
      pathCurriculo:['', []],
    });
  }

  // ── Máscara telefone ────────────────────────────────────────────────────────
  onTelefoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '').slice(0, 11);
    let masked = digits;
    if (digits.length > 2)  masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length > 7)  masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    input.value = masked;
    this.form.get('telefone')!.setValue(digits, { emitEvent: false });
  }

  // ── Envio ────────────────────────────────────────────────────────────────────
  enviar(): void {
    if (this.form.invalid || !this.vaga || this.enviando) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.enviando = true;

    const dto: CreateCandidaturaDTO = {
      vagaID:        this.vaga.id,
      nome:          this.form.value.nome.trim(),
      email:         this.form.value.email.trim().toLowerCase(),
      telefone:      this.form.value.telefone,
      urlLinkedin:   this.form.value.urlLinkedin?.trim() ?? '',
      pathCurriculo: this.form.value.pathCurriculo?.trim() ?? '',
    };

    this.candidaturaService.criar(dto)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false)),
      )
      .subscribe({
        next:  () => (this.step = 'sucesso'),
        error: (err) => {
          this.erroMsg = err?.error ?? 'Ocorreu um erro ao enviar a candidatura.';
          this.step = 'erro';
        },
      });
  }

  resetar(): void {
    this.step = 'form';
    this.erroMsg = '';
    this.enviando = false;
    this.form?.reset();
  }

  onFechar(): void {
    this.fechar.emit();
  }

  // ── Helpers de validação ─────────────────────────────────────────────────────
  invalid(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c?.touched);
  }

  errocampo(campo: string): string {
    const c = this.form.get(campo);
    if (!c?.errors) return '';
    if (c.errors['required'])   return 'Campo obrigatório.';
    if (c.errors['email'])      return 'E-mail inválido.';
    if (c.errors['minlength'])  return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['pattern'])    return 'URL do LinkedIn inválida.';
    return 'Valor inválido.';
  }
}

