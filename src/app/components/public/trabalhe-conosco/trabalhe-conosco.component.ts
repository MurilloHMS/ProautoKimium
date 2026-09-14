import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';

import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

import { ResponseVagaDTO } from '../../../domain/models/vaga.model';
import { CreateCandidaturaDTO } from '../../../domain/models/candidatura.model';
import { CreateTalentBankEntryDTO } from '../../../domain/models/talent-bank.model';
import { apiMessage } from '../../../domain/utils/api-error';
import { erroDoCurriculo } from '../../../domain/utils/talent-bank';
import { VagaService } from '../../../infrastructure/services/processoSeletivo/vaga/vaga.service';
import { CandidaturaService } from '../../../infrastructure/services/processoSeletivo/candidatura/candidatura.service';
import { TalentBankService } from '../../../infrastructure/services/processoSeletivo/talent-bank/talent-bank.service';

type ModalStep = 'detalhe' | 'form' | 'sucesso' | 'erro';

/** Valor do "Outra" no combo de área: libera o campo de texto. */
const AREA_OUTRA = '__outra__';

@Component({
  selector: 'app-trabalhe-conosco',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    SelectModule,
    SkeletonModule,
  ],
  templateUrl: './trabalhe-conosco.component.html',
  styleUrl: './trabalhe-conosco.component.scss',
})
export class TrabalheConoscoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly AREA_OUTRA = AREA_OUTRA;

  vagas: ResponseVagaDTO[] = [];
  vagasFiltradas: ResponseVagaDTO[] = [];
  isLoading = false;
  erro = false;

  termoBusca = '';
  areaSelecionada: string | null = null;
  opcoesArea: { label: string; value: string }[] = [];

  /**
   * As áreas de todas as vagas cadastradas, para o combo do banco de talentos.
   * Não sai de `opcoesArea`: aquelas são só as das vagas publicadas, e ficam
   * vazias exatamente quando não há vaga aberta.
   */
  opcoesAreaInteresse: { label: string; value: string }[] = [{ label: 'Outra', value: AREA_OUTRA }];

  vagaSelecionada: ResponseVagaDTO | null = null;

  /** O mesmo modal, sem vaga e sem a etapa de detalhe. */
  cadastroAberto = false;

  modalStep: ModalStep = 'detalhe';

  form!: FormGroup;
  enviando = false;
  erroMsg = '';

  curriculoFile: File | null = null;
  curriculoErro = '';

  /** O e-mail do cadastro, para a confirmação dizer para onde o link foi. */
  emailEnviado = '';

  linkCopiado: string | null = null; // id da vaga cujo link foi copiado recentemente

  constructor(
    private vagaService: VagaService,
    private candidaturaService: CandidaturaService,
    private talentBankService: TalentBankService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.carregarVagas();
    this.carregarAreasDeInteresse();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.overflow = '';
  }

  get modalAberto(): boolean {
    return !!this.vagaSelecionada || this.cadastroAberto;
  }

  private buildForm(): void {
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefone: ['', [Validators.required, Validators.minLength(10)]],
      urlLinkedin: ['', [Validators.pattern(/^(https?:\/\/)?(www\.)?linkedin\.com\/.+/)]],
      areaInteresse: [null as string | null],
      areaOutra: ['', [Validators.maxLength(100)]],
      consentimento: [false],
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
          this.abrirVagaPorQueryParam();
        },
        error: () => {
          this.erro = true;
        },
      });
  }

  /** Sem as áreas o cadastro continua funcionando: sobra o "Outra". */
  private carregarAreasDeInteresse(): void {
    this.vagaService
      .getAreas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (areas) => {
          const unicas = [...new Set(areas.map((a) => a?.trim()).filter(Boolean))].sort();
          this.opcoesAreaInteresse = [
            ...unicas.map((a) => ({ label: a, value: a })),
            { label: 'Outra', value: AREA_OUTRA },
          ];
        },
        error: () => {},
      });
  }

  private abrirVagaPorQueryParam(): void {
    const vagaId = this.route.snapshot.queryParamMap.get('vaga');
    if (!vagaId) return;

    const vaga = this.vagas.find((v) => String(v.id) === vagaId);
    if (vaga) {
      this.abrirVaga(vaga);
    }
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

  private resetarModal(): void {
    this.form.reset({ areaInteresse: null, areaOutra: '', consentimento: false });
    this.erroMsg = '';
    this.enviando = false;
    this.curriculoFile = null;
    this.curriculoErro = '';
    this.emailEnviado = '';
  }

  abrirVaga(vaga: ResponseVagaDTO): void {
    this.cadastroAberto = false;
    this.vagaSelecionada = vaga;
    this.modalStep = 'detalhe';
    this.resetarModal();
    document.body.style.overflow = 'hidden';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vaga: vaga.id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  abrirCadastro(): void {
    this.vagaSelecionada = null;
    this.cadastroAberto = true;
    this.modalStep = 'form';
    this.resetarModal();
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
    const tinhaVaga = !!this.vagaSelecionada;

    this.vagaSelecionada = null;
    this.cadastroAberto = false;
    this.modalStep = 'detalhe';
    this.resetarModal();
    document.body.style.overflow = '';

    if (tinhaVaga) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { vaga: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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
      consentimento: !!this.form.value.consentimento,
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
        error: (err: HttpErrorResponse) => {
          if (err?.status === 409) {
            this.erroMsg = 'Você já se candidatou para esta vaga.';
          } else {
            this.erroMsg = this.mensagemDeErro(err, 'Ocorreu um erro ao enviar a candidatura.');
          }

          this.modalStep = 'erro';
        },
      });
  }

  /**
   * Autorização e currículo são obrigatórios aqui, e não na candidatura a uma
   * vaga — então a checagem fica neste método, e não nos validadores do form.
   */
  get cadastroPronto(): boolean {
    return !!this.form?.value.consentimento && !!this.curriculoFile && !this.curriculoErro;
  }

  enviarCadastro(): void {
    this.form.markAllAsTouched();

    if (!this.curriculoFile && !this.curriculoErro) {
      this.curriculoErro = 'Anexe seu currículo em PDF.';
    }

    if (this.form.invalid || !this.cadastroPronto || this.enviando) {
      return;
    }

    this.enviando = true;

    const email = this.form.value.email.trim().toLowerCase();
    const dto: CreateTalentBankEntryDTO = {
      nome: this.form.value.nome.trim(),
      email,
      telefone: this.form.value.telefone,
      urlLinkedin: this.form.value.urlLinkedin?.trim() ?? '',
      areaInteresse: this.areaInteresseEscolhida(),
      consentimento: true,
    };

    this.talentBankService
      .inscrever(dto, this.curriculoFile!)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        // A resposta é a mesma para e-mail novo e para quem já está no banco.
        // Não existe ramo aqui para tratar diferente, e não pode existir.
        next: () => {
          this.emailEnviado = email;
          this.modalStep = 'sucesso';
        },
        error: (err: HttpErrorResponse) => {
          this.erroMsg = this.mensagemDeErro(err, 'Não conseguimos enviar seu cadastro agora.');
          this.modalStep = 'erro';
        },
      });
  }

  private areaInteresseEscolhida(): string | null {
    const area = this.form.value.areaInteresse as string | null;
    if (area === AREA_OUTRA) {
      return this.form.value.areaOutra?.trim() || null;
    }
    return area || null;
  }

  private mensagemDeErro(err: HttpErrorResponse, padrao: string): string {
    if (err?.status === 413) return 'O arquivo passa de 10 MB.';
    if (err?.status === 400) return apiMessage(err) ?? padrao;
    return padrao;
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

    const erro = erroDoCurriculo(file);
    if (erro) {
      this.curriculoErro = erro;
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
    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (control.errors['pattern']) return 'URL do LinkedIn inválida.';

    return 'Valor inválido.';
  }

  copiarLink(vagaId: string | number, event?: MouseEvent): void {
    event?.stopPropagation();

    const url = new URL(window.location.href);
    url.searchParams.set('vaga', String(vagaId));

    navigator.clipboard.writeText(url.toString()).then(() => {
      this.linkCopiado = String(vagaId);
      setTimeout(() => {
        if (this.linkCopiado === String(vagaId)) {
          this.linkCopiado = null;
        }
      }, 2000);
    });
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

  protected readonly String = String;
}
