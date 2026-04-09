import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';

import {
  ResponseCandidaturaDTO,
  EtapaCandidatura,
  ETAPAS_CONFIG,
  STATUS_CONFIG,
} from '../../../../domain/models/candidatura.model';
import { CandidaturaService } from '../../../../infrastructure/services/processoSeletivo/candidatura/candidatura.service';

type AcaoPendente = 'avancar' | 'aprovar' | 'reprovar' | 'encerrar' | null;

@Component({
  selector: 'app-candidaturas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candidaturas.component.html',
  styleUrl: './candidaturas.component.scss',
})
export class CandidaturasComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  vagaId    = '';
  vagaTitulo = '';

  candidaturas: ResponseCandidaturaDTO[] = [];
  selecionada: ResponseCandidaturaDTO | null = null;

  isLoading = false;
  erro = false;

  emExecucao: Record<string, AcaoPendente> = {};
  confirmando: { id: string; acao: 'reprovar' | 'encerrar' } | null = null;

  etapasConfig = ETAPAS_CONFIG;
  statusConfig  = STATUS_CONFIG;
  etapasOrdem: EtapaCandidatura[] = ['TRIAGEM', 'ENTREVISTA_RH', 'PROPOSTA', 'CONTRATADO'];

  constructor(
    private service: CandidaturaService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Lê vagaId e vagaTitulo dos queryParams
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.vagaId     = params['vagaId']    ?? '';
        this.vagaTitulo = params['vagaTitulo'] ?? '';
        if (this.vagaId) this.carregar();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Voltar para o painel de vagas ─────────────────────────────────────────
  voltar(): void {
    this.router.navigate(['/rh/painel-de-vagas']);
  }

  // ── Carregar ──────────────────────────────────────────────────────────────
  carregar(): void {
    this.isLoading = true;
    this.erro = false;
    this.selecionada = null;

    this.service.getByVaga(this.vagaId)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.isLoading = false)))
      .subscribe({
        next:  (data) => (this.candidaturas = data),
        error: () => (this.erro = true),
      });
  }

  // ── Seleção ───────────────────────────────────────────────────────────────
  selecionar(c: ResponseCandidaturaDTO): void {
    this.selecionada = this.selecionada?.id === c.id ? null : c;
    this.confirmando = null;
  }

  fecharDetalhe(): void {
    this.selecionada = null;
    this.confirmando = null;
  }

  // ── Ações ─────────────────────────────────────────────────────────────────
  avancar(c: ResponseCandidaturaDTO): void  { this.executar(c.id, 'avancar', this.service.avancar(c.id)); }
  aprovar(c: ResponseCandidaturaDTO): void  { this.executar(c.id, 'aprovar', this.service.aprovar(c.id)); }

  confirmarReprovar(c: ResponseCandidaturaDTO): void { this.confirmando = { id: c.id, acao: 'reprovar' }; }
  confirmarEncerrar(c: ResponseCandidaturaDTO): void { this.confirmando = { id: c.id, acao: 'encerrar' }; }
  cancelarConfirmacao(): void { this.confirmando = null; }

  executarConfirmado(): void {
    if (!this.confirmando) return;
    const { id, acao } = this.confirmando;
    this.confirmando = null;
    const obs = acao === 'reprovar' ? this.service.reprovar(id) : this.service.encerrar(id);
    this.executar(id, acao, obs);
  }

  private executar(id: string, acao: AcaoPendente, obs: ReturnType<CandidaturaService['avancar']>): void {
    this.emExecucao[id] = acao;
    obs.pipe(
      takeUntil(this.destroy$),
      finalize(() => delete this.emExecucao[id])
    ).subscribe({ next: () => { this.carregar(); this.fecharDetalhe(); } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  isExecutando(id: string): boolean { return id in this.emExecucao; }

  podeAvancar(c: ResponseCandidaturaDTO): boolean { return c.status === 'EM_ANDAMENTO' && c.etapaAtual !== 'CONTRATADO'; }
  podeAprovar(c: ResponseCandidaturaDTO): boolean { return c.status === 'EM_ANDAMENTO'; }
  podeReprovar(c: ResponseCandidaturaDTO): boolean { return c.status === 'EM_ANDAMENTO'; }
  podeEncerrar(c: ResponseCandidaturaDTO): boolean { return c.status !== 'ENCERRADO'; }

  formatarData(iso: string | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  }

  etapaOrdem(etapa: EtapaCandidatura): number { return ETAPAS_CONFIG[etapa]?.ordem ?? 0; }
  por(etapa: EtapaCandidatura): ResponseCandidaturaDTO[] { return this.candidaturas.filter(c => c.etapaAtual === etapa); }
  get skeletons(): number[] { return [1, 2, 3, 4]; }
}
