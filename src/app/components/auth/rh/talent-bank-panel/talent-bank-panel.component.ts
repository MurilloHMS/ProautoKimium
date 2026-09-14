import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Select } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import {
  TalentBankConsentimento,
  TalentBankFiltros,
  TalentBankOrigem,
  TalentBankSituacao,
  TalentBankSummaryDTO,
} from '../../../../domain/models/talent-bank.model';
import { apiMessage } from '../../../../domain/utils/api-error';
import { formatarData, situacaoDaAutorizacao, SituacaoDaAutorizacao } from '../../../../domain/utils/talent-bank';
import { TalentBankService } from '../../../../infrastructure/services/processoSeletivo/talent-bank/talent-bank.service';
import { VagaService } from '../../../../infrastructure/services/processoSeletivo/vaga/vaga.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';

interface Linha extends TalentBankSummaryDTO {
  situacao: SituacaoDaAutorizacao;
}

/**
 * Aba "Banco de talentos" do painel de vagas.
 *
 * **Abre mostrando todo mundo**, decisão dele sobre o mockup. No dia em que
 * subir, as 21 pessoas da base vieram de candidaturas antes de 2026-09-11 e não
 * têm autorização registrada: um filtro padrão em "Autorizado" abriria a aba
 * vazia, e elas sumiriam sem ninguém perceber.
 *
 * Os filtros vão para a API, e não são aplicados aqui: "vencido" depende do
 * relógio do servidor, e duas contas de vencimento — uma em cada ponta — é como
 * a lista e a exclusão automática começam a discordar.
 */
@Component({
  selector: 'app-talent-bank-panel',
  standalone: true,
  imports: [
    FormsModule, Select, TooltipModule,
    ToolbarComponent, PkTableComponent, PkButtonComponent, PkDialogComponent, PkCanDirective,
  ],
  templateUrl: './talent-bank-panel.component.html',
  styleUrl: './talent-bank-panel.component.scss',
})
export class TalentBankPanelComponent implements OnInit {
  private readonly service = inject(TalentBankService);
  private readonly vagaService = inject(VagaService);
  private readonly permissions = inject(PermissionStore);
  private readonly messages = inject(MessageService, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  readonly formatarData = formatarData;

  readonly linhas = signal<Linha[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal(false);

  readonly filtros = signal<TalentBankFiltros>({
    q: '',
    area: null,
    origem: 'TODOS',
    consentimento: 'TODOS',
    situacao: 'TODOS',
  });

  readonly opcoesArea = signal<{ label: string; value: string }[]>([]);

  readonly opcoesOrigem: { label: string; value: TalentBankOrigem }[] = [
    { label: 'Toda origem', value: 'TODOS' },
    { label: 'Sem vaga', value: 'ESPONTANEO' },
    { label: 'De candidatura', value: 'CANDIDATURA' },
  ];

  readonly opcoesConsentimento: { label: string; value: TalentBankConsentimento }[] = [
    { label: 'Toda autorização', value: 'TODOS' },
    { label: 'Autorizado', value: 'COM' },
    { label: 'Sem registro', value: 'SEM' },
  ];

  readonly opcoesSituacao: { label: string; value: TalentBankSituacao }[] = [
    { label: 'Vigentes e vencidos', value: 'TODOS' },
    { label: 'Vigentes', value: 'VIGENTE' },
    { label: 'Vencidos', value: 'VENCIDO' },
  ];

  readonly filtrosAtivos = computed(() => {
    const f = this.filtros();
    return !!f.q.trim() || !!f.area || f.origem !== 'TODOS' || f.consentimento !== 'TODOS' || f.situacao !== 'TODOS';
  });

  /**
   * A API aceita as duas authorities de download: a aba mora na tela de vagas,
   * mas o arquivo é o mesmo que a tela de candidaturas baixa. Esconder por uma
   * só deixaria um dos lados sem o botão que o servidor autoriza.
   */
  readonly podeBaixar = computed(() =>
    this.permissions.canByCode('rh/painel-de-vagas:BAIXAR') ||
    this.permissions.canByCode('rh/candidaturas:BAIXAR'),
  );

  // ── Exclusão ──────────────────────────────────────────────────────────────
  readonly excluindo = signal<Linha | null>(null);
  readonly excluindoSalvando = signal(false);

  private readonly busca$ = new Subject<void>();

  ngOnInit(): void {
    this.busca$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.carregar());

    this.carregar();

    this.vagaService.getAreas().subscribe({
      next: (areas) => {
        const unicas = [...new Set(areas.map((a) => a?.trim()).filter(Boolean))].sort();
        this.opcoesArea.set(unicas.map((a) => ({ label: a, value: a })));
      },
      error: () => {},
    });
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);

    this.service.listar(this.filtros()).subscribe({
      next: (dados) => {
        const agora = new Date();
        this.linhas.set(dados.map((d) => ({
          ...d,
          situacao: situacaoDaAutorizacao(d.consentimentoEm, d.expiraEm, agora),
        })));
        this.carregando.set(false);
      },
      error: () => {
        this.linhas.set([]);
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }

  aoDigitarBusca(q: string): void {
    this.filtros.update((f) => ({ ...f, q }));
    this.busca$.next();
  }

  aoFiltrar<K extends keyof TalentBankFiltros>(campo: K, valor: TalentBankFiltros[K]): void {
    this.filtros.update((f) => ({ ...f, [campo]: valor }));
    this.carregar();
  }

  limparFiltros(): void {
    this.filtros.set({ q: '', area: null, origem: 'TODOS', consentimento: 'TODOS', situacao: 'TODOS' });
    this.carregar();
  }

  dicaDaSituacao(linha: Linha): string {
    if (!linha.consentimentoEm) {
      return 'Veio de uma candidatura antes de 11/09/2026. Não autorizou ficar para vagas futuras, e não vence.';
    }
    if (linha.situacao.papel === 'neutral') {
      // Não prometer a limpeza automática: o agendador que apaga ainda não existe.
      return `O prazo de guarda acabou em ${formatarData(linha.expiraEm)}.`;
    }
    return `Autorizou em ${formatarData(linha.consentimentoEm)}.`;
  }

  baixar(linha: Linha): void {
    this.service.baixarCurriculo(linha.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `curriculo-${this.nomeDeArquivo(linha.nome)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: () => this.avisar('error', 'Não foi possível baixar o currículo.'),
    });
  }

  pedirExclusao(linha: Linha): void {
    this.excluindo.set(linha);
  }

  fecharExclusao(): void {
    if (this.excluindoSalvando()) return;
    this.excluindo.set(null);
  }

  confirmarExclusao(): void {
    const linha = this.excluindo();
    if (!linha || this.excluindoSalvando()) return;

    this.excluindoSalvando.set(true);
    this.service.excluir(linha.id).subscribe({
      next: () => {
        this.excluindoSalvando.set(false);
        this.excluindo.set(null);
        this.linhas.update((ls) => ls.filter((l) => l.id !== linha.id));
        this.avisar('success', linha.quantidadeDeCandidaturas > 0
          ? 'Dados pessoais apagados. As candidaturas continuam no histórico.'
          : 'Cadastro apagado.');
      },
      error: (err: HttpErrorResponse) => {
        this.excluindoSalvando.set(false);
        this.avisar('error', apiMessage(err) ?? 'Não foi possível excluir.');
      },
    });
  }

  private avisar(severity: 'success' | 'error', detail: string): void {
    this.messages?.add({ severity, summary: severity === 'error' ? 'Erro' : 'Sucesso', detail, life: 3500 });
  }

  private nomeDeArquivo(nome: string): string {
    return (nome || 'candidato')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'candidato';
  }
}
