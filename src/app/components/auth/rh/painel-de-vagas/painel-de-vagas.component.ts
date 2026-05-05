import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize, switchMap, of } from 'rxjs';

import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { VagaService } from '../../../../infrastructure/services/processoSeletivo/vaga/vaga.service';
import { CreateVagaDTO, ResponseVagaDTO, UpdateVagaDTO } from '../../../../domain/models/vaga.model';
import {CandidaturasComponent} from "../candidaturas/candidaturas.component";
import {Router} from "@angular/router";

type TabStatus = 'publicadas' | 'rascunho' | 'arquivadas' | 'encerradas';

interface TabConfig {
  key: TabStatus;
  label: string;
  icon: string;
  loader: () => void;
}

const CAMPO_LIMITS = {
  titulo:           100,
  descricao:       1000,
  requisitos:      1000,
  beneficios:      1000,
  area:             100,
} as const;

@Component({
  selector: 'app-painel-de-vagas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, TagModule, ButtonModule,
    SkeletonModule, TooltipModule, BadgeModule, InputText, Select,
    DialogModule, TextareaModule, ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './painel-de-vagas.component.html',
  styleUrl: './painel-de-vagas.component.scss',
})
export class PainelDeVagasComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly limites = CAMPO_LIMITS;

  activeTab: TabStatus = 'publicadas';

  tabs: TabConfig[] = [
    { key: 'publicadas', label: 'Publicadas',  icon: 'pi-check-circle',  loader: () => this.loadPublicadas()  },
    { key: 'rascunho',   label: 'Rascunho',    icon: 'pi-file-edit',     loader: () => this.loadRascunhos()   },
    { key: 'arquivadas', label: 'Arquivadas',  icon: 'pi-inbox',         loader: () => this.loadArquivadas()  },
    { key: 'encerradas', label: 'Encerradas',  icon: 'pi-times-circle',  loader: () => this.loadEncerradas()  },
  ];

  vagas: ResponseVagaDTO[] = [];
  vagasFiltradas: ResponseVagaDTO[] = [];
  isLoading = false;
  erroCarregamento = false;

  termoBusca = '';
  areaSelecionada: string | null = null;
  opcoesArea: { label: string; value: string }[] = [];
  expandedRows: { [key: string]: boolean } = {};

  modalAberto = false;
  salvando = false;
  vagaEmEdicao: ResponseVagaDTO | null = null;

  vagaCriadaId: string | null = null;   // id da vaga recém-criada para exibir o link
  linkModalAberto = false;              // controla o dialog de link
  linkCopiado = false;

  formVaga: CreateVagaDTO = this.formVazio();

  colunas = [
    { field: 'titulo',           header: 'Título',            sortable: true },
    { field: 'area',             header: 'Área',              sortable: true },
    { field: 'dataAbertura',     header: 'Data Abertura',     sortable: true },
    { field: 'dataEncerramento', header: 'Data Encerramento', sortable: true },
  ];

  constructor(
    private vagaService: VagaService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void { this.loadPublicadas(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  get formValido(): boolean {
    const f = this.formVaga;
    return (
      !!f.titulo?.trim() &&
      !!f.area?.trim() &&
      f.titulo.length     <= CAMPO_LIMITS.titulo     &&
      f.descricao.length  <= CAMPO_LIMITS.descricao  &&
      f.requisitos.length <= CAMPO_LIMITS.requisitos &&
      f.beneficios.length <= CAMPO_LIMITS.beneficios &&
      f.area.length       <= CAMPO_LIMITS.area
    );
  }

  setTab(tab: TabConfig): void {
    if (this.activeTab === tab.key) return;
    this.activeTab = tab.key;
    this.termoBusca = '';
    this.areaSelecionada = null;
    this.expandedRows = {};
    tab.loader();
  }

  private loadPublicadas(): void { this.fetch(this.vagaService.getVagasPublicadas()); }
  private loadRascunhos():  void { this.fetch(this.vagaService.getVagasEmRascunho()); }
  private loadArquivadas(): void { this.fetch(this.vagaService.getVagasArquivadas()); }
  private loadEncerradas(): void { this.fetch(this.vagaService.getVagasEncerradas()); }

  private fetch(obs: ReturnType<typeof this.vagaService.getVagasPublicadas>): void {
    this.isLoading = true;
    this.erroCarregamento = false;
    this.vagas = [];
    this.vagasFiltradas = [];
    obs.pipe(takeUntil(this.destroy$), finalize(() => (this.isLoading = false))).subscribe({
      next: (data) => { this.vagas = data; this.buildAreaOptions(data); this.aplicarFiltros(); },
      error: () => { this.erroCarregamento = true; },
    });
  }

  private buildAreaOptions(vagas: ResponseVagaDTO[]): void {
    const areas = [...new Set(vagas.map((v) => v.area).filter(Boolean))].sort();
    this.opcoesArea = areas.map((a) => ({ label: a, value: a }));
  }

  aplicarFiltros(): void {
    const termo = this.termoBusca.toLowerCase().trim();
    const area  = this.areaSelecionada;
    this.vagasFiltradas = this.vagas.filter((v) => {
      const matchTermo = !termo || v.titulo?.toLowerCase().includes(termo) || v.area?.toLowerCase().includes(termo);
      const matchArea  = !area  || v.area === area;
      return matchTermo && matchArea;
    });
  }

  limparFiltros(): void { this.termoBusca = ''; this.areaSelecionada = null; this.aplicarFiltros(); }
  get filtrosAtivos(): boolean { return !!this.termoBusca || !!this.areaSelecionada; }

  abrirModalNova(): void {
    this.vagaEmEdicao = null;
    this.formVaga = this.formVazio();
    this.modalAberto = true;
  }

  abrirModalEditar(vaga: ResponseVagaDTO): void {
    this.vagaEmEdicao = vaga;
    this.formVaga = {
      titulo:           vaga.titulo,
      descricao:        vaga.descricao,
      requisitos:       vaga.requisitos,
      beneficios:       vaga.beneficios,
      area:             vaga.area,
      dataAbertura:     vaga.dataAbertura,
      dataEncerramento: vaga.dataEncerramento,
    };
    this.modalAberto = true;
  }

  fecharModal(): void { this.modalAberto = false; }

  salvarVaga(publicar = false): void {
    this.salvando = true;

    if (!this.vagaEmEdicao) {
      this.vagaService.createVaga(this.formVaga).pipe(
        takeUntil(this.destroy$),
        switchMap((id: string) => {
          const cleanId = id.replace(/"/g, '');
          this.vagaCriadaId = cleanId;
          return publicar
            ? this.vagaService.publicarVaga(cleanId)
            : of(cleanId);
        }),
        finalize(() => (this.salvando = false)),
      ).subscribe({
        next: () => {
          this.toast('success', publicar ? 'Vaga publicada!' : 'Rascunho salvo!');
          this.fecharModal();
          this.activeTab = publicar ? 'publicadas' : 'rascunho';
          this.recarregar();
          this.linkCopiado = false;
          this.linkModalAberto = true;
        },
        error: () => this.toast('error', 'Erro ao salvar a vaga.'),
      });

    } else {
      const payload: UpdateVagaDTO = { id: this.vagaEmEdicao.id, ...this.formVaga };
      this.vagaService.updateVaga(payload).pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.salvando = false)),
      ).subscribe({
        next: () => {
          this.toast('success', 'Vaga atualizada!');
          this.fecharModal();
          this.recarregar();
        },
        error: () => this.toast('error', 'Erro ao atualizar a vaga.'),
      });
    }
  }


  publicar(vaga: ResponseVagaDTO): void {
    this.vagaService.publicarVaga(vaga.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast('success', 'Vaga publicada!'); this.recarregar(); },
      error: () => this.toast('error', 'Erro ao publicar.'),
    });
  }

  arquivar(vaga: ResponseVagaDTO): void {
    this.vagaService.arquivarVaga(vaga.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast('success', 'Vaga arquivada.'); this.recarregar(); },
      error: () => this.toast('error', 'Erro ao arquivar.'),
    });
  }

  encerrar(vaga: ResponseVagaDTO): void {
    this.vagaService.encerrarVaga(vaga.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast('success', 'Vaga encerrada.'); this.recarregar(); },
      error: () => this.toast('error', 'Erro ao encerrar.'),
    });
  }

  moverParaRascunho(vaga: ResponseVagaDTO): void {
    this.vagaService.rascunhoVaga(vaga.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast('info', 'Vaga movida para rascunho.'); this.recarregar(); },
      error: () => this.toast('error', 'Erro ao mover para rascunho.'),
    });
  }


  toggleRow(vaga: ResponseVagaDTO): void {
    if (this.expandedRows[vaga.id]) delete this.expandedRows[vaga.id];
    else this.expandedRows = { [vaga.id]: true };
  }

  isExpanded(vaga: ResponseVagaDTO): boolean { return !!this.expandedRows[vaga.id]; }

  recarregar(): void {
    const tab = this.tabs.find((t) => t.key === this.activeTab)!;
    tab.loader();
  }

  formatarData(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); }
    catch { return '—'; }
  }

  get linkVaga(): string {
    if (!this.vagaCriadaId) return '';
    const base = window.location.origin;
    return `${base}/trabalhe-conosco?vaga=${this.vagaCriadaId}`;
  }

  copiarLink(): void {
    navigator.clipboard.writeText(this.linkVaga).then(() => {
      this.linkCopiado = true;
      setTimeout(() => (this.linkCopiado = false), 2500);
    });
  }

  private formVazio(): CreateVagaDTO {
    return { titulo: '', descricao: '', requisitos: '', beneficios: '', area: '', dataAbertura: '', dataEncerramento: '' };
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Erro' : 'Sucesso', detail, life: 3000 });
  }

  verCandidaturas(vaga: ResponseVagaDTO): void {
    this.router.navigate(['rh/candidaturas'], {
      queryParams: {
        vagaId: vaga.id,
        vagaTitulo: vaga.titulo
      }
    });
  }

  obterLink(vaga: ResponseVagaDTO) {
    this.vagaCriadaId = vaga.id.replace('g', '');
    this.linkModalAberto = true;
    this.linkCopiado = false;
  }
}
