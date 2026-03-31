import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';

import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

import { ResponseVagaDTO } from '../../../domain/models/vaga.model';
import { VagaService } from '../../../infrastructure/services/processoSeletivo/vaga/vaga.service';
import { CandidaturaService, CreateCandidaturaDTO } from '../../../infrastructure/services/processoSeletivo/candidatura/candidatura.service';

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

  // ── Vagas ────────────────────────────────────────────────────────────────────
  vagas: ResponseVagaDTO[] = [];
  vagasFiltradas: ResponseVagaDTO[] = [];
  isLoading = false;
  erro = false;

  // ── Filtros ──────────────────────────────────────────────────────────────────
  termoBusca = '';
  areaSelecionada: string | null = null;
  opcoesArea: { label: string; value: string }[] = [];

  // ── Modal único com passos ───────────────────────────────────────────────────
  vagaSelecionada: ResponseVagaDTO | null = null;
  modalStep: ModalStep = 'detalhe';

  // ── Formulário de candidatura ────────────────────────────────────────────────
  form!: FormGroup;
  enviando = false;
  erroMsg = '';

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
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  private buildForm(): void {
    this.form = this.fb.group({
      nome:          ['', [Validators.required, Validators.minLength(3)]],
      email:         ['', [Validators.required, Validators.email]],
      telefone:      ['', [Validators.required, Validators.minLength(10)]],
      urlLinkedin:   ['', [Validators.pattern(/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/)]],
      pathCurriculo: [''],
    });
  }

  // ── Carregar vagas ───────────────────────────────────────────────────────────
  carregarVagas(): void {
    this.isLoading = true;
    this.erro = false;
    this.vagaService
      .getVagasPublicadas()
      .pipe(takeUntil(this.destroy$), finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (data) => { this.vagas = data; this.buildAreas(data); this.filtrar(); },
        error: () => (this.erro = true),
      });
  }

  private buildAreas(vagas: ResponseVagaDTO[]): void {
    const areas = [...new Set(vagas.map((v) => v.area).filter(Boolean))].sort();
    this.opcoesArea = areas.map((a) => ({ label: a, value: a }));
  }

  // ── Filtros ──────────────────────────────────────────────────────────────────
  filtrar(): void {
    const t = this.termoBusca.toLowerCase().trim();
    const a = this.areaSelecionada;
    this.vagasFiltradas = this.vagas.filter(
      (v) =>
        (!t || v.titulo?.toLowerCase().includes(t) || v.area?.toLowerCase().includes(t)) &&
        (!a || v.area === a)
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

  // ── Navegação do modal ───────────────────────────────────────────────────────
  abrirVaga(vaga: ResponseVagaDTO): void {
    this.vagaSelecionada = vaga;
    this.modalStep = 'detalhe';
    this.form.reset();
    this.erroMsg = '';
    document.body.style.overflow = 'hidden';
  }

  irParaForm(): void {
    this.modalStep = 'form';
  }

  voltarParaDetalhe(): void {
    this.modalStep = 'detalhe';
    this.form.reset();
    this.erroMsg = '';
  }

  fecharModal(): void {
    this.vagaSelecionada = null;
    this.modalStep = 'detalhe';
    this.form.reset();
    this.erroMsg = '';
    this.enviando = false;
    document.body.style.overflow = '';
  }

  // ── Envio ────────────────────────────────────────────────────────────────────
  enviar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.vagaSelecionada || this.enviando) return;

    this.enviando = true;
    const dto: CreateCandidaturaDTO = {
      vagaID:        this.vagaSelecionada.id,
      nome:          this.form.value.nome.trim(),
      email:         this.form.value.email.trim().toLowerCase(),
      telefone:      this.form.value.telefone,
      urlLinkedin:   this.form.value.urlLinkedin?.trim() ?? '',
      pathCurriculo: this.form.value.pathCurriculo?.trim() ?? '',
    };

    this.candidaturaService.criar(dto)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.enviando = false)))
      .subscribe({
        next:  () => (this.modalStep = 'sucesso'),
        error: (err) => {
          this.erroMsg = err?.error ?? 'Ocorreu um erro ao enviar a candidatura.';
          this.modalStep = 'erro';
        },
      });
  }

  tentarNovamente(): void {
    this.modalStep = 'form';
    this.erroMsg = '';
  }

  // ── Máscara telefone ─────────────────────────────────────────────────────────
  onTelefoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let d = input.value.replace(/\D/g, '').slice(0, 11);
    let m = d;
    if (d.length > 2) m = `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length > 7) m = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    input.value = m;
    this.form.get('telefone')!.setValue(d, { emitEvent: false });
  }

  // ── Validação ────────────────────────────────────────────────────────────────
  invalid(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c?.touched);
  }

  erroCampo(campo: string): string {
    const c = this.form.get(campo);
    if (!c?.errors) return '';
    if (c.errors['required'])  return 'Campo obrigatório.';
    if (c.errors['email'])     return 'E-mail inválido.';
    if (c.errors['minlength']) return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['pattern'])   return 'URL do LinkedIn inválida.';
    return 'Valor inválido.';
  }

  formatarData(iso: string): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); }
    catch { return '—'; }
  }

  get skeletons(): number[] {
    return Array.from({ length: 6 }, (_, i) => i);
  }
}
