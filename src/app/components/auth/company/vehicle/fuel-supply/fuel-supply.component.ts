import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { PkButtonComponent } from '../../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkComboboxComponent } from '../../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkTableComponent } from '../../../../theme/ProautoKimium/pk-table/pk-table.component';
import { PKTitleComponent } from '../../../../theme/ProautoKimium/pk-title/pk-title.component';

import {
  FORMAT_OPTIONS,
  FormatOption,
  FuelSupplyReportRequest,
  MONTH_OPTIONS,
  MonthOption,
  ReportFormat
} from '../../../../../domain/models/report.model';
import {
  DepartmentOption,
  FiltroDeConferencia,
  FuelSupplyImportRow,
  LinhaDeConferencia
} from '../../../../../domain/models/fuel-supply-audit.model';
import { FuelSuppyService } from '../../../../../infrastructure/services/company/vehicle/fuelSupply/fuel-suppy.service';

/**
 * Abastecimento: enviar, conferir, emitir.
 *
 * <b>Por que são três passos.</b> Até 2026-09-24 a tela tinha dois, e o
 * primeiro gravava: escolher o arquivo e clicar em "Enviar Planilha" já punha
 * tudo no banco, com a API respondendo "Importação concluída com sucesso!"
 * mesmo quando a gravação falhava e mesmo quando o motorista não casava com
 * nenhum funcionário — caso em que a linha caía calada num departamento
 * chamado SEM_DEPARTAMENTO, e o relatório, que agrupa por departamento, saía
 * errado sem ninguém perceber.
 *
 * Agora o envio só lê. O que a pessoa vê na conferência é exatamente o que vai
 * ser gravado, e é isso que o botão manda de volta — não o arquivo outra vez.
 */
@Component({
  selector: 'app-fuel-supply-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TooltipModule,
    PkButtonComponent,
    PkComboboxComponent,
    PkTableComponent,
    PKTitleComponent,
  ],
  providers: [MessageService],
  templateUrl: './fuel-supply.component.html',
  styleUrl: './fuel-supply.component.scss'
})
export class FuelSupplyComponent implements OnInit {

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly service = inject(FuelSuppyService);
  private readonly messageService = inject(MessageService);

  // ── Passos ────────────────────────────────────────────────────────────────

  readonly passo = signal<1 | 2 | 3>(1);

  // ── Passo 1: envio ────────────────────────────────────────────────────────

  selectedFile: File | null = null;
  readonly conferindo = signal(false);
  readonly baixandoModelo = signal(false);

  // ── Passo 2: conferência ──────────────────────────────────────────────────

  readonly linhas = signal<LinhaDeConferencia[]>([]);
  readonly departamentos = signal<DepartmentOption[]>([]);
  readonly filtro = signal<FiltroDeConferencia>('tudo');
  readonly busca = signal('');
  readonly gravando = signal(false);
  readonly recusas = signal<string[]>([]);
  readonly nomeDoArquivo = signal('');

  // ── Passo 3: emissão ──────────────────────────────────────────────────────

  monthOptions: MonthOption[] = MONTH_OPTIONS;
  formatOptions: FormatOption[] = FORMAT_OPTIONS;
  yearOptions: { label: string; value: number }[] = [];

  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedFormat: ReportFormat = 'PDF';

  readonly loadingReport = signal(false);
  readonly exportando = signal(false);

  // ── Contagens ─────────────────────────────────────────────────────────────

  readonly totalLidas = computed(() => this.linhas().length);
  readonly marcadas = computed(() => this.linhas().filter(l => l.selecionada));
  readonly semMotorista = computed(() => this.linhas().filter(l => !l.motoristaEncontrado));
  readonly duplicadas = computed(() => this.linhas().filter(l => l.jaExiste));
  readonly semDepartamento = computed(() =>
    this.linhas().filter(l => l.selecionada && !l.departmentId));

  /** As linhas que não podem ser gravadas de olhos fechados. */
  readonly pedemAtencao = computed(() =>
    this.linhas().filter(l => !l.motoristaEncontrado || l.jaExiste || !l.departmentId));

  readonly linhasVisiveis = computed<LinhaDeConferencia[]>(() => {
    const doFiltro = (() => {
      switch (this.filtro()) {
        case 'atencao':       return this.pedemAtencao();
        case 'sem-motorista': return this.semMotorista();
        case 'duplicadas':    return this.duplicadas();
        default:              return this.linhas();
      }
    })();

    const termo = chaveDeNome(this.busca());

    if (!termo) return doFiltro;

    return doFiltro.filter(l =>
      chaveDeNome(l.driverName ?? '').includes(termo) ||
      chaveDeNome(l.plate ?? '').includes(termo));
  });

  /**
   * Quantos motoristas distintos a planilha tem.
   *
   * <p>É o número que importa na hora de escolher departamento: a planilha de
   * agosto tem 246 linhas e 34 motoristas. Uma pessoa dirige para um
   * departamento só, então são 34 decisões, não 246.
   */
  readonly totalDeMotoristas = computed(() =>
    new Set(this.linhas().map(l => chaveDeNome(l.driverName ?? ''))).size);

  readonly motoristasSemDepartamento = computed(() =>
    new Set(this.linhas()
      .filter(l => !l.departmentId)
      .map(l => chaveDeNome(l.driverName ?? ''))).size);

  readonly temConferenciaPendente = computed(() => this.linhas().length > 0);

  readonly todasMarcadas = computed(() =>
    this.linhas().length > 0 && this.marcadas().length === this.linhas().length);

  readonly resumoDoPasso2 = computed(() => {
    if (!this.temConferenciaPendente()) return 'nada conferido ainda';

    const atencao = this.pedemAtencao().length;
    return atencao === 0
      ? `${this.totalLidas()} linhas, nenhuma pendência`
      : `${atencao} ${atencao === 1 ? 'linha pede' : 'linhas pedem'} atenção`;
  });

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.buildYearOptions();
    this.carregarDepartamentos();
  }

  private buildYearOptions(): void {
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 3; y--) {
      this.yearOptions.push({ label: String(y), value: y });
    }
  }

  private carregarDepartamentos(): void {
    this.service.listarDepartamentos().subscribe({
      next: (lista) => this.departamentos.set(lista),
      error: () => this.messageService.add({
        severity: 'error',
        summary: 'Departamentos',
        detail: 'Não foi possível carregar a lista de departamentos. A conferência precisa dela para gravar.'
      })
    });
  }

  // ── Navegação ─────────────────────────────────────────────────────────────

  /**
   * O passo 2 só abre com conferência na mão. O 3 abre sempre: emitir um
   * relatório de março não depende de ter acabado de importar agosto.
   */
  irPara(passo: 1 | 2 | 3): void {
    if (passo === 2 && !this.temConferenciaPendente()) return;
    this.passo.set(passo);
  }

  // ── Passo 1 ───────────────────────────────────────────────────────────────

  get fileSizeLabel(): string {
    if (!this.selectedFile) return '';
    const kb = this.selectedFile.size / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formato inválido',
        detail: 'Apenas arquivos .xlsx são aceitos.'
      });
      this.clearFile();
      return;
    }

    this.selectedFile = file;
  }

  clearFile(): void {
    this.selectedFile = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  baixarModelo(): void {
    this.baixandoModelo.set(true);

    this.service.baixarModelo().subscribe({
      next: (blob) => {
        this.service.salvarPlanilha(blob, 'modelo-abastecimentos.xlsx');
        this.baixandoModelo.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Modelo',
          detail: 'Não foi possível baixar o modelo.'
        });
        this.baixandoModelo.set(false);
      }
    });
  }

  /**
   * Lê a planilha e vai para a conferência.
   *
   * As duplicatas chegam desmarcadas, e é a única decisão que a tela toma
   * sozinha: reenviar a planilha do mês é o erro mais comum, e marcar tudo por
   * padrão faria o duplo envio passar despercebido. Marcar de volta é um
   * clique — e existem dois abastecimentos idênticos de verdade.
   */
  conferir(): void {
    if (!this.selectedFile) return;

    this.conferindo.set(true);
    this.recusas.set([]);

    this.service.conferirPlanilha(this.selectedFile).subscribe({
      next: (linhas) => {
        this.linhas.set(linhas.map(l => ({ ...l, selecionada: !l.jaExiste })));
        this.nomeDoArquivo.set(this.selectedFile?.name ?? '');
        this.filtro.set(this.pedemAtencao().length > 0 ? 'atencao' : 'tudo');
        this.conferindo.set(false);
        this.clearFile();

        if (linhas.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Planilha vazia',
            detail: 'Nenhuma linha preenchida foi encontrada no arquivo.'
          });
          return;
        }

        this.passo.set(2);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Não foi possível ler a planilha',
          detail: typeof err.error === 'string'
            ? err.error
            : 'Confira se o arquivo segue o modelo, com as 13 colunas na mesma ordem.'
        });
        this.conferindo.set(false);
      }
    });
  }

  // ── Passo 2 ───────────────────────────────────────────────────────────────

  alternarLinha(linha: LinhaDeConferencia): void {
    this.linhas.update(todas => todas.map(l =>
      l.linha === linha.linha ? { ...l, selecionada: !l.selecionada } : l));
  }

  marcarTodas(marcar: boolean): void {
    this.linhas.update(todas => todas.map(l => ({ ...l, selecionada: marcar })));
  }

  /**
   * O departamento vale para o <b>motorista</b>, e não para a linha.
   *
   * <p>Uma pessoa dirige para um departamento só, e a planilha do mês traz a
   * mesma pessoa dezenas de vezes: escolher linha a linha seriam 246 cliques
   * para 34 decisões, e bastaria errar um para o relatório do mês sair com a
   * mesma pessoa em dois departamentos.
   */
  definirDepartamento(linha: LinhaDeConferencia, departmentId: string | null): void {
    const nome = this.departamentos().find(d => d.id === departmentId)?.name ?? null;
    const motorista = chaveDeNome(linha.driverName ?? '');

    let alteradas = 0;

    this.linhas.update(todas => todas.map(l => {
      if (chaveDeNome(l.driverName ?? '') !== motorista) return l;
      alteradas++;
      return { ...l, departmentId, departmentName: nome };
    }));

    if (alteradas > 1) {
      this.messageService.add({
        severity: 'info',
        summary: nome ?? 'Departamento',
        detail: `Aplicado às ${alteradas} linhas de ${linha.driverName}.`,
        life: 2500
      });
    }
  }

  /**
   * Aplica o mesmo departamento a todo mundo que ainda está sem.
   *
   * <p>Quando a planilha inteira é de uma frota só, é um clique em vez de 34.
   */
  aplicarDepartamentoNasVazias(departmentId: string | null): void {
    if (!departmentId) return;

    const nome = this.departamentos().find(d => d.id === departmentId)?.name ?? null;
    const motoristas = this.motoristasSemDepartamento();

    this.linhas.update(todas => todas.map(l =>
      l.departmentId ? l : { ...l, departmentId, departmentName: nome }));

    this.messageService.add({
      severity: 'info',
      summary: nome ?? 'Departamento',
      detail: `Aplicado a ${motoristas} ${motoristas === 1 ? 'motorista' : 'motoristas'} que estavam sem.`,
      life: 2500
    });
  }

  situacaoDaLinha(linha: LinhaDeConferencia): { texto: string; tom: 'ok' | 'warn' | 'erro' } {
    if (linha.selecionada && !linha.departmentId) {
      return { texto: 'sem departamento', tom: 'erro' };
    }
    if (linha.jaExiste) {
      return { texto: 'já existe', tom: 'warn' };
    }
    if (!linha.motoristaEncontrado) {
      return { texto: 'sem cadastro', tom: 'warn' };
    }
    return { texto: 'pronta', tom: 'ok' };
  }

  gravar(): void {
    const marcadas = this.marcadas();

    if (marcadas.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Nada marcado',
        detail: 'Marque ao menos uma linha para gravar.'
      });
      return;
    }

    const semDepartamento = this.semDepartamento();

    if (semDepartamento.length > 0) {
      this.filtro.set('atencao');
      this.messageService.add({
        severity: 'warn',
        summary: 'Falta o departamento',
        detail: `${semDepartamento.length} ${semDepartamento.length === 1
          ? 'linha marcada está' : 'linhas marcadas estão'} sem departamento. O relatório agrupa por ele.`
      });
      return;
    }

    this.gravando.set(true);
    this.recusas.set([]);

    this.service.gravarConferidos(marcadas.map(l => this.paraGravacao(l))).subscribe({
      next: (resultado) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Abastecimentos gravados',
          detail: `${resultado.gravadas} ${resultado.gravadas === 1 ? 'linha gravada' : 'linhas gravadas'}. Já dá para emitir o relatório.`
        });

        this.busca.set('');
        this.linhas.set([]);
        this.nomeDoArquivo.set('');
        this.gravando.set(false);
        this.passo.set(3);
      },
      error: (err) => {
        const motivos: string[] = err?.error?.motivos ?? [];

        this.recusas.set(motivos);
        this.messageService.add({
          severity: 'error',
          summary: 'Nada foi gravado',
          detail: motivos.length > 0
            ? `${motivos.length} ${motivos.length === 1 ? 'linha foi recusada' : 'linhas foram recusadas'} — e a remessa inteira foi cancelada.`
            : 'Não foi possível gravar os abastecimentos. Tente novamente.'
        });
        this.gravando.set(false);
      }
    });
  }

  private paraGravacao(linha: LinhaDeConferencia): FuelSupplyImportRow {
    return {
      linha: linha.linha,
      fuelSupplyDate: linha.fuelSupplyDate,
      uf: linha.uf,
      plate: linha.plate,
      driverName: linha.driverName,
      departmentId: linha.departmentId,
      actualHodometer: linha.actualHodometer,
      diferenceHodometer: linha.diferenceHodometer,
      averageKm: linha.averageKm,
      fuelType: linha.fuelType,
      liters: linha.liters,
      price: linha.price,
      totalValue: linha.totalValue
    };
  }

  descartarConferencia(): void {
    this.busca.set('');
    this.linhas.set([]);
    this.recusas.set([]);
    this.nomeDoArquivo.set('');
    this.passo.set(1);
  }

  // ── Passo 3 ───────────────────────────────────────────────────────────────

  get selectedMonthLabel(): string {
    return this.monthOptions.find(m => m.value === this.selectedMonth)?.label ?? '';
  }

  private get primeiroDia(): string {
    return `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-01`;
  }

  private get ultimoDia(): string {
    const dia = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    return `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${dia}`;
  }

  exportarDados(): void {
    this.exportando.set(true);

    this.service.exportarPeriodo(this.primeiroDia, this.ultimoDia).subscribe({
      next: (blob) => {
        this.service.salvarPlanilha(blob,
          `abastecimentos-${String(this.selectedMonth).padStart(2, '0')}-${this.selectedYear}.xlsx`);
        this.exportando.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Exportação',
          detail: 'Não foi possível exportar os dados do período.'
        });
        this.exportando.set(false);
      }
    });
  }

  generate(): void {
    this.loadingReport.set(true);

    const request: FuelSupplyReportRequest = {
      month: this.selectedMonth,
      year: this.selectedYear,
      format: this.selectedFormat
    };

    this.service.generateReport(request).subscribe({
      next: (blob) => {
        this.service.downloadFile(blob, this.selectedFormat, this.selectedMonth, this.selectedYear);
        this.messageService.add({
          severity: 'success',
          summary: 'Relatório gerado',
          detail: `Download iniciado — ${this.selectedMonthLabel}/${this.selectedYear}`
        });
        this.loadingReport.set(false);
      },
      error: (err) => {
        const detail = err.status === 204
          ? 'Nenhum registro encontrado para o período informado.'
          : 'Não foi possível gerar o relatório. Tente novamente.';
        this.messageService.add({ severity: 'error', summary: 'Erro', detail });
        this.loadingReport.set(false);
      }
    });
  }
}

/**
 * O nome reduzido ao que dá para comparar e procurar.
 *
 * <p>Minúsculas, sem acento e sem espaço sobrando — é a mesma regra que a API
 * usa para casar o motorista com o cadastro. Aqui ela serve para duas coisas:
 * a busca achar "Vinicius" quando a planilha escreveu "Vinícius", e o
 * departamento escolhido pegar todas as linhas da mesma pessoa mesmo quando o
 * cartão escreveu o nome dela de dois jeitos no mesmo mês.
 */
function chaveDeNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
