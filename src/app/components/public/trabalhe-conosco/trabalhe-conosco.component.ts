import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';

import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

import { ResponseVagaDTO } from '../../../domain/models/vaga.model';
import { CreateCandidaturaDTO } from '../../../domain/models/candidatura.model';
import { VagaService } from '../../../infrastructure/services/processoSeletivo/vaga/vaga.service';
import { CandidaturaService } from '../../../infrastructure/services/processoSeletivo/candidatura/candidatura.service';

type ModalStep = 'detalhe' | 'form' | 'sucesso' | 'erro';

@Component({
  selector: 'app-trabalhe-conosco',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
  ],
  templateUrl: './trabalhe-conosco.component.html',
  styleUrl: './trabalhe-conosco.component.scss',
})
export class TrabalheConoscoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  vagas: ResponseVagaDTO[] = [];
  vagasFiltradas: ResponseVagaDTO[] = [];
  isLoading = false;
  erro = false;

  termoBusca = '';
  areaSelecionada: string | null = null;
  opcoesArea: { label: string; value: string }[] = [];

  vagaSelecionada: ResponseVagaDTO | null = null;
  modalStep: ModalStep = 'detalhe';

  form!: FormGroup;
  enviando = false;
  erroMsg = '';

  curriculoFile: File | null = null;
  curriculoErro = '';

  constructor(
    private vagaService: VagaService,
    private candidaturaService: CandidaturaService,
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.carregarVagas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.overflow = '';
  }

  private buildForm(): void {
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefone: ['', [Validators.required, Validators.minLength(10)]],
      urlLinkedin: ['', [Validators.pattern(/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/)]],
    });
  }

  carregarVagas(): void {
    this.isLoading = true;
    this.erro = false;

    this.vagaService
      .getVagasPublicadas()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: (data) => {
          this.vagas = data;
          this.buildAreas(data);
          this.filtrar();
        },
        error: () => {
          this.erro = true;
        },
      });
  }

  private buildAreas(vagas: ResponseVagaDTO[]): void {
    const areas = [...new Set(vagas.map((v) => v.area).filter(Boolean))].sort();
    this.opcoesArea = areas.map((a) => ({ label: a, value: a }));
  }

  filtrar(): void {
    const termo = this.termoBusca.toLowerCase().trim();
    const area = this.areaSelecionada;

    this.vagasFiltradas = this.vagas.filter(
      (vaga) =>
        (!termo ||
          vaga.titulo?.toLowerCase().includes(termo) ||
          vaga.area?.toLowerCase().includes(termo)) &&
        (!area || vaga.area === area)
    );
  }

  limpar(): void {
    this.termoBusca = '';
    this.areaSelecionada = null;
    this.filtrar();
  }

  get filtrosAtivos(): boolean {
    return !!this.termoBusca || !!this.areaSelecionada;
  }

  abrirVaga(vaga: ResponseVagaDTO): void {
    this.vagaSelecionada = vaga;
    this.modalStep = 'detalhe';
    this.form.reset();
    this.erroMsg = '';
    this.enviando = false;
    this.curriculoFile = null;
    this.curriculoErro = '';
    document.body.style.overflow = 'hidden';
  }

  irParaForm(): void {
    this.modalStep = 'form';
  }

  voltarParaDetalhe(): void {
    this.modalStep = 'detalhe';
    this.erroMsg = '';
  }

  fecharModal(): void {
    this.vagaSelecionada = null;
    this.modalStep = 'detalhe';
    this.form.reset();
    this.erroMsg = '';
    this.enviando = false;
    this.curriculoFile = null;
    this.curriculoErro = '';
    document.body.style.overflow = '';
  }

  tentarNovamente(): void {
    this.modalStep = 'form';
    this.erroMsg = '';
  }

  enviar(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || !this.vagaSelecionada || this.enviando) {
      return;
    }

    if (this.curriculoErro) {
      return;
    }

    this.enviando = true;

    const dto: CreateCandidaturaDTO = {
      vagaID: this.vagaSelecionada.id,
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
          this.modalStep = 'sucesso';
        },
        error: (err) => {
          this.erroMsg = err?.error ?? 'Ocorreu um erro ao enviar a candidatura.';
          this.modalStep = 'erro';
        },
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

  invalid(campo: string): boolean {
    const control = this.form.get(campo);
    return !!(control?.invalid && control?.touched);
  }

  erroCampo(campo: string): string {
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

  formatarData(iso: string): string {
    if (!iso) return '—';

    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  }

  get skeletons(): number[] {
    return Array.from({ length: 6 }, (_, i) => i);
  }
}
