import { CommonModule, formatDate } from '@angular/common';
import { Component, DestroyRef, HostListener, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_ICON,
  MACHINE_STATUS_SEVERITY,
  MachineStatus,
  IN_STOCK_STATUSES,
  machineStatusOptions,
  stockDeltaFor,
} from '../../../../domain/models/prostock/machine.model';
import {
  CreateMachineRegister,
  MachineRegister,
  ScheduleChange,
  ScheduleEdit,
  UpdateMachineRegister,
} from '../../../../domain/models/prostock/register.model';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { formatStampBr, parseDateOnly } from '../../../../domain/utils/date-only';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { ProgramacaoImportComponent } from './programacao-import.component';

/**
 * Linha da grade: o registro da API mais a data já convertida para o datepicker.
 *
 * O estado de "salvando/salvo" NÃO mora aqui. As linhas são recriadas toda vez
 * que o `computed` roda, então uma flag no objeto se perderia no primeiro
 * recálculo — fica em signals por id.
 */
interface Row extends Omit<MachineRegister, 'status'> {
  previsao: Date | null;

  /**
   * Nulo **só** no rascunho.
   *
   * A linha nova nasce sem status para obrigar a escolha: antes ela nascia em
   * `DISPONIVEL`, e quem não reparasse na célula criava máquina em estoque e
   * confirmava o `+1` sem querer. `AGUARDANDO_AQUISICAO` — máquina que ainda
   * não foi comprada — era justamente o caso que o padrão atrapalhava.
   */
  status: MachineStatus | null;
}

/**
 * As colunas que ordenam.
 *
 * `machine` e não `machineId`: o nome já diz em voz alta que a ordem é pelo
 * nome exibido, não pelo id guardado.
 */
type SortField = 'machine' | 'nomeCliente' | 'regiao' | 'solicitante' | 'status'
               | 'previsao' | 'consultor' | 'tecnico' | 'tag' | 'updatedAt';

/** Um rascunho que já pode ser gravado: o `canSaveDraft` é quem prova isso. */
type SavableDraft = Row & { status: MachineStatus };

/**
 * Programação de máquinas.
 *
 * **Tabela enxuta + painel** (opção A, escolhida por ele num mockup em
 * 2026-09-28). A grade editável célula a célula tinha doze colunas e ~1785px:
 * metade ficava fora da tela, e cada edição abria uma janela de motivo e, às
 * vezes, outra de estoque, uma depois da outra. Agora:
 *
 * - seis colunas, com o que era coluna própria (tag, região, técnico,
 *   observação) na segunda linha da célula;
 * - a **previsão** — a edição de quase sempre — é um botão na linha, que abre o
 *   calendário com o motivo ali mesmo;
 * - o resto se edita num **formulário** (painel à direita no computador, folha
 *   de baixo no celular), e o motivo e o estoque são perguntas DENTRO dele, não
 *   janelas novas.
 *
 * Os filtros viraram chips com contagem porque o quadro passa de duzentas
 * linhas: status, atraso e "sem previsão" são os recortes que o time faz.
 */
@Component({
  selector: 'app-programacao',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, DatePickerModule, InputTextModule,
    ButtonModule, Toast, Tooltip, PkButtonComponent, PkComboboxComponent,
    ProgramacaoImportComponent, PkDialogComponent, PkSheetComponent,
    TextareaModule, PkSegmentedComponent],
  templateUrl: './programacao.component.html',
  styleUrl: './programacao.component.scss',
  providers: [MessageService],
})
export class ProgramacaoComponent implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MachineRegisterStore);
  private readonly machineStore = inject(MachineStore);
  private readonly registerService = inject(RegisterService);
  private readonly inventoryService = inject(InventoryProductService);
  private readonly messageService = inject(MessageService);

  readonly loading = this.store.loading;
  readonly statusOptions = machineStatusOptions();

  // ─── As abas: em andamento e entregues ────────────────────────────────────

  /**
   * Entregue já saiu do galpão e não pede mais nada de ninguém: fica na própria
   * aba, fora do foco. Pedido dele (2026-10-02) — a lista do dia a dia é o que
   * ainda vai sair.
   */
  readonly aba = signal<'andamento' | 'entregues'>('andamento');

  readonly deliveredCount = computed(() =>
    this.store.items().filter(r => r.status === MachineStatus.ENTREGUE).length);

  readonly abaOptions = computed(() => [
    { label: `Em andamento · ${this.store.items().length - this.deliveredCount()}`, value: 'andamento' },
    { label: `Entregues · ${this.deliveredCount()}`, value: 'entregues' },
  ]);

  /** Os chips de status da aba Em andamento: Entregue tem a aba dele. */
  readonly chipStatusOptions = this.statusOptions.filter(o => o.value !== MachineStatus.ENTREGUE);

  /**
   * Trocar de aba limpa os recortes de prazo e de status: "Atrasadas" ou
   * "Reservada" não existem entre as entregues, e levá-los junto daria uma
   * lista vazia sem explicação. Busca e máquina continuam: valem nas duas.
   */
  setAba(aba: 'andamento' | 'entregues'): void {
    this.aba.set(aba);
    this.statusFilter.set([]);
    this.onlyLate.set(false);
    this.semPrevisao.set(false);
    this.saidaAte.set(null);
  }
  readonly machineOptions = this.machineStore.activeOptions;

  search = '';
  private readonly searchTrigger = signal(0);

  // ─── Filtros da toolbar ───────────────────────────────────────────────────
  // Visão rápida: o quadro tem ~200 linhas e ninguém lê tudo. Os três recortes
  // que o time usa são status, máquina e "o que está atrasado".
  readonly statusFilter = signal<MachineStatus[]>([]);
  readonly machineFilter = signal<string | null>(null);
  readonly onlyLate = signal(false);

  /**
   * Só as linhas sem data de saída.
   *
   * Nasceu do Hub: a faixa "Precisa de você" avisa "N máquinas sem previsão" e
   * o botão dizia "Programar" — mas abria a grade inteira, e a pessoa tinha que
   * caçar quais eram. Aviso que não leva ao recorte é meio aviso.
   */
  readonly semPrevisao = signal(false);

  /**
   * Só o que sai até esta data, entre as **abertas**.
   *
   * Nasceu do cartão "Próximas saídas" do Hub, cujo "Ver todas" abria a grade
   * inteira. Exclui ENTREGUE junto porque o cartão de lá também exclui — se o
   * filtro trouxesse entregues, o número da tela não bateria com o do aviso, e
   * um número que não bate com a origem destrói a confiança nos dois.
   */
  readonly saidaAte = signal<Date | null>(null);

  // ─── O motivo ─────────────────────────────────────────────────────────────
  //
  // Opcional: obrigar ensinava a digitar "ok" para passar da tela, e o campo
  // perdia justamente para quem adia de verdade. E **não é mais janela**: era
  // um diálogo que abria depois do "Salvar", e agora é um campo que aparece no
  // próprio formulário (ou no calendário) assim que a edição passa a pedi-lo.
  // Quem vai escrever vê a pergunta antes de decidir salvar; quem não vai,
  // salva de uma vez.

  /** O motivo digitado no formulário. */
  readonly formReason = signal('');

  /** O motivo digitado junto do calendário da previsão. */
  readonly dateReason = signal('');

  // ─── O estoque ────────────────────────────────────────────────────────────
  //
  // Uma linha de programação é uma máquina física. Sair do estoque para
  // ENTREGUE tira uma do galpão; voltar devolve. O formulário mostra o número
  // antes de gravar, porque "mudei um status" e "mexi no estoque" não parecem a
  // mesma ação para quem está editando.

  readonly loadingStock = signal(false);
  readonly currentStock = signal(0);

  /** A máquina cujo estoque está em `currentStock` — evita um GET por tecla. */
  private stockLoadedFor: string | null = null;

  /**
   * Baixar (ou devolver) no estoque junto com a edição?
   *
   * Sim por padrão, que é o certo quando as duas contagens batem. O "não mexer"
   * existe para quem já acertou o estoque pela tela de movimentação e só está
   * atualizando a programação.
   */
  readonly adjustStockChoice = signal(true);

  /**
   * Quanto o estoque muda se o formulário for salvo como está.
   *
   * Linha nova conta a partir do nada (`stockDeltaFor(null, …)`): nascer em
   * estoque é uma máquina entrando no galpão.
   */
  readonly stockDelta = computed(() => {
    const draft = this.formRascunho();
    if (!draft?.status) return 0;

    if (this.isDraft(draft)) return stockDeltaFor(null, draft.status);

    const stored = this.store.items().find(item => item.id === draft.id);
    return stored ? stockDeltaFor(stored.status, draft.status) : 0;
  });

  readonly newStock = computed(() => this.currentStock() + this.stockDelta());

  /**
   * O estoque em movimentações não bate com a programação.
   *
   * Acontece de verdade: são duas contagens do mesmo fato, e qualquer caminho
   * antigo pode tê-las separado. Travar aqui deixaria a pessoa sem saída, então
   * a opção de baixar some e a edição grava só a programação.
   */
  readonly stockWouldGoNegative = computed(() => this.newStock() < 0);

  /**
   * O que vai no `adjustStock`: nada quando a edição não cruza a fronteira do
   * galpão — a API lê ausência como `false`, e é o que ela sempre recebeu.
   */
  readonly stockAnswer = computed<boolean | undefined>(() => {
    if (this.stockDelta() === 0) return undefined;
    return this.adjustStockChoice() && !this.stockWouldGoNegative();
  });

  // ─── Histórico de adiamentos ─────────────────────────────────────────────
  //
  // Carregado sob demanda, um GET por vez que alguém abre. A alternativa seria
  // trazer a contagem junto da grade, e aí seria um GET por linha numa tela que
  // costuma ter centenas — caro para uma informação que se consulta raramente.

  /**
   * O mesmo locale que o `| date` do template usa.
   *
   * Fixar "pt-BR" aqui faria esta data divergir de todas as outras da tela no
   * dia em que o app rodar em outro locale — e divergir em silêncio.
   */
  private readonly locale = inject(LOCALE_ID);

  readonly historicoAberto = signal(false);
  readonly historicoCarregando = signal(false);
  readonly historico = signal<ScheduleChange[]>([]);
  readonly historicoDe = signal<string>('');

  abrirHistorico(row: Row): void {
    if (this.isDraft(row)) return;

    this.historicoDe.set(row.nomeCliente?.trim() || 'programação sem cliente');
    this.historico.set([]);
    this.historicoCarregando.set(true);
    this.historicoAberto.set(true);

    this.registerService.scheduleChanges(row.id).subscribe({
      next: (lista) => {
        this.historico.set(lista ?? []);
        this.historicoCarregando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.historicoCarregando.set(false);
        this.historicoAberto.set(false);
        this.showError(err);
      },
    });
  }

  /**
   * As linhas soltas da API viram uma entrada por **edição**.
   *
   * Chave: autor + instante. As linhas de uma mesma edição saem do serviço numa
   * transação só, com o mesmo `changedAt` até o milissegundo — não é
   * coincidência que dá para explorar, é como elas são gravadas.
   *
   * `Map` e não `reduce` num objeto: preserva a ordem de chegada, que já vem do
   * mais recente para o mais antigo, e é a ordem em que se lê.
   */
  readonly historicoAgrupado = computed<ScheduleEdit[]>(() => {
    const edicoes = new Map<string, ScheduleEdit>();

    for (const linha of this.historico()) {
      const chave = `${linha.changedAt}|${linha.changedBy ?? ''}`;
      const existente = edicoes.get(chave);

      if (existente) {
        existente.campos.push(linha);
        // O motivo é o mesmo nas linhas da edição, mas só se sabe disso pela
        // API. Pegar o primeiro que não for nulo sobrevive a ela mudar de
        // ideia e gravar a justificativa em uma linha só.
        existente.motivo ??= linha.motivo;
        continue;
      }

      edicoes.set(chave, {
        id: chave,
        changedBy: linha.changedBy,
        changedAt: linha.changedAt,
        motivo: linha.motivo,
        campos: [linha],
      });
    }

    return [...edicoes.values()];
  });

  /**
   * O rótulo de cada campo, como a coluna da grade se chama.
   *
   * Quem abre o histórico acabou de olhar a tabela. Um campo que aparece aqui
   * com outro nome custa uma tradução mental a cada linha.
   */
  private static readonly ROTULO_DO_CAMPO: Record<string, string> = {
    nomeCliente: 'Cliente',
    regiao: 'Região',
    solicitante: 'Solicitante',
    previsao: 'Previsão',
    consultor: 'Consultor',
    tecnico: 'Técnico',
    tag: 'Tag',
    status: 'Status',
  };

  rotuloDoCampo(campo: string): string {
    return ProgramacaoComponent.ROTULO_DO_CAMPO[campo] ?? campo;
  }

  /**
   * Devolve cada valor ao formato em que ele vive na tela.
   *
   * A API guarda tudo como texto, porque é uma coluna só para oito campos —
   * data em ISO, status pela chave do enum. Sem isto o histórico mostraria
   * `2026-09-22T00:00` e `AGUARDANDO_AQUISICAO`, que é o banco falando, não a
   * tela.
   *
   * Nulo devolve nulo, e não "—": quem decide como desenhar ausência é o
   * template, que a mostra apagada em vez de deixar um espaço em branco — um
   * branco seria lido como falha de carregamento.
   */
  valorDoCampo(campo: string, valor: string | null): string | null {
    if (valor === null) return null;

    if (campo === 'previsao') {
      const data = new Date(valor);
      return isNaN(data.getTime()) ? valor : formatDate(data, 'dd/MM/yyyy', this.locale);
    }

    if (campo === 'status') {
      return MACHINE_STATUS_LABEL[valor as MachineStatus] ?? valor;
    }

    return valor;
  }

  readonly hasFilters = computed(() =>
    this.statusFilter().length > 0 || !!this.machineFilter()
    || this.onlyLate() || this.semPrevisao() || !!this.saidaAte());

  // ─── Os chips de filtro ───────────────────────────────────────────────────

  /** A folha de filtros do celular (máquina e limpar). */
  readonly filtersOpen = signal(false);

  /**
   * Quantas linhas há em cada status, sobre o quadro inteiro.
   *
   * Sobre o quadro e não sobre o recorte: o número do chip responde "quantas
   * existem", e ele não pode mudar só porque outro chip foi ligado.
   */
  readonly statusCounts = computed(() => {
    const counts = new Map<MachineStatus, number>();
    for (const register of this.store.items()) {
      counts.set(register.status, (counts.get(register.status) ?? 0) + 1);
    }
    return counts;
  });

  readonly noForecastCount = computed(() =>
    this.store.items().filter(register => !register.previsaoEntrega).length);

  /**
   * "Atrasadas" e "Sem previsão" se excluem.
   *
   * Atrasada precisa de data, e sem previsão não tem: as duas juntas davam uma
   * lista sempre vazia, que se lê como "não há nada", e não como "você ligou
   * dois filtros impossíveis". Ligar uma desliga a outra.
   */
  toggleLate(): void {
    const on = !this.onlyLate();
    this.onlyLate.set(on);
    if (on) this.semPrevisao.set(false);
  }

  toggleNoForecast(): void {
    const on = !this.semPrevisao();
    this.semPrevisao.set(on);
    if (on) this.onlyLate.set(false);
  }

  /** Os chips de status somam: dá para ver Reservada e Reforma juntas. */
  toggleStatus(status: MachineStatus): void {
    this.statusFilter.update(current => current.includes(status)
      ? current.filter(item => item !== status)
      : [...current, status]);
  }

  isStatusOn(status: MachineStatus): boolean {
    return this.statusFilter().includes(status);
  }

  /**
   * O nome curto do chip. Dois rótulos longos faziam a fileira quebrar em duas
   * linhas a 1280px; o nome inteiro continua no selo da linha e no `title`.
   */
  private static readonly CHIP_LABEL: Partial<Record<MachineStatus, string>> = {
    [MachineStatus.LIBERAR_EQUIPAMENTOS]: 'Liberar',
    [MachineStatus.AGUARDANDO_AQUISICAO]: 'Aguardando',
  };

  chipLabel(status: MachineStatus): string {
    return ProgramacaoComponent.CHIP_LABEL[status] ?? this.statusLabel(status);
  }

  /** O chip na cor do status — o mesmo papel de cor do selo na linha. */
  statusChipClass(status: MachineStatus): string {
    return `chip chip--status chip--${MACHINE_STATUS_SEVERITY[status] ?? 'neutral'}`;
  }

  // ─── O menu "⋯" ────────────────────────────────────────────────────────────

  /** Guarda o que é de vez em quando (importar planilha), fora da barra. */
  readonly actionsOpen = signal(false);

  /** Clique fora fecha — o botão e o menu param o clique antes de chegar aqui. */
  @HostListener('document:click')
  closeActions(): void {
    if (this.actionsOpen()) this.actionsOpen.set(false);
  }

  /**
   * Grade ou importação. A importação ocupa a tela inteira, como os cadastros:
   * a conferência mostra ~200 linhas e num diálogo isso fica espremido.
   */
  readonly mode = signal<'grid' | 'import'>('grid');

  // ─── Celular: a planilha vira lista de cartões ────────────────────────────

  /**
   * Abaixo de `$bp-md` (768px) a planilha some e entram os cartões.
   *
   * É `@if` e não `display: none` porque a tabela do PrimeNG monta onze colunas
   * por linha: escondê-la por CSS deixaria todo esse DOM vivo num aparelho que
   * nunca vai mostrá-lo.
   *
   * Sinal próprio, e não o `TabHandleStore.enabled` que já existe com a média
   * inversa: aquele significa "as abas estão ligadas", e amarrar o layout desta
   * tela a ele faria os cartões aparecerem no desktop no dia em que alguém
   * desligasse as abas.
   */
  readonly ehCelular = signal(false);

  // ─── O atalho da previsão ─────────────────────────────────────────────────

  /**
   * A linha cuja data está sendo trocada, e a data escolhida antes de gravar.
   *
   * A data vai para um rascunho e não direto na linha: desistir tem que deixar
   * a tela como estava. Escrever na linha e depois desfazer é o caminho em que
   * a pessoa sai achando que salvou — o mesmo motivo do `cancelarMotivo`.
   */
  readonly previsaoAberta = signal<Row | null>(null);
  readonly previsaoRascunho = signal<Date | string | null>(null);

  /**
   * O campo de motivo aparece quando a data que já existia vai mudar.
   *
   * A mesma regra do `pedeMotivo`, restrita ao único campo que o calendário
   * mexe: preencher a primeira data é completar cadastro, e não pergunta.
   */
  readonly dateNeedsReason = computed(() => {
    const row = this.previsaoAberta();
    if (!row?.previsao) return false;

    const chosen = this.previsaoRascunho();
    const next = chosen instanceof Date ? this.toLocalDateTime(chosen) : null;
    return dayPart(this.toLocalDateTime(row.previsao)) !== dayPart(next);
  });

  abrirPrevisao(row: Row): void {
    this.previsaoRascunho.set(row.previsao ?? null);
    this.dateReason.set('');
    this.previsaoAberta.set(row);
  }

  /**
   * Os atalhos do calendário, contados a partir de hoje.
   *
   * De hoje e não da data atual: a linha que mais se reprograma é a atrasada, e
   * "+1 semana" sobre uma data vencida continuaria vencida.
   */
  quickDate(kind: 'week' | 'fortnight' | 'monthEnd'): void {
    const today = startOfToday();
    const date = kind === 'monthEnd'
      ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() + (kind === 'week' ? 7 : 15));
    this.previsaoRascunho.set(date);
  }

  confirmarPrevisao(): void {
    const row = this.previsaoAberta();
    if (!row) return;

    row.previsao = this.previsaoRascunho() as Row['previsao'];
    this.previsaoAberta.set(null);

    // O mesmo caminho do formulário: `hasChanges` e a regra do motivo
    // continuam valendo. Chamar o service daqui perderia os dois em silêncio.
    this.salvarLinha(row, { reason: this.dateReason().trim() || null });
  }

  cancelarPrevisao(): void {
    this.previsaoAberta.set(null);
  }

  /**
   * `Esc` fecha a folha.
   *
   * O `pk-dialog` dava isto de graça; a folha é nossa, então o atalho vem
   * junto — sair de um painel modal pelo teclado não é opcional.
   */
  @HostListener('document:keydown.escape')
  onEscapeFolha(): void {
    if (this.actionsOpen()) {
      this.actionsOpen.set(false);
      return;
    }

    // O calendário vem por cima do formulário quando os dois estão abertos:
    // fecha o de cima primeiro, senão o Esc engoliria a folha inteira e a
    // pessoa perderia o que já tinha digitado.
    if (this.previsaoAberta()) {
      this.cancelarPrevisao();
      return;
    }

    if (this.formAberto()) this.fecharForm();
  }

  // ─── O formulário completo ────────────────────────────────────────────────

  /**
   * Tudo que não é a previsão: status, cliente, técnico, observação…
   *
   * Painel à direita no computador, folha de baixo no celular — o mesmo
   * formulário, desenhado uma vez no template.
   *
   * Edita uma **cópia**. Só no salvar os valores voltam para a linha, então
   * fechar sem salvar não deixa nada pela metade — e o `hasChanges` continua
   * barrando o PUT de quem abriu e fechou sem mexer.
   */
  readonly formAberto = signal(false);
  readonly formRascunho = signal<Row | null>(null);
  private formAlvo: Row | null = null;

  /** A linha aberta no painel, para a tabela marcar onde a pessoa está. */
  readonly selectedId = computed(() => this.formAberto() ? this.formRascunho()?.id ?? null : null);

  /**
   * O campo de motivo aparece quando a edição passa a pedi-lo.
   *
   * Calculado sobre a cópia a cada tecla, com a mesma regra que decide o que a
   * API registra no histórico. Rascunho não pergunta: a linha nem existe.
   */
  readonly formNeedsReason = computed(() => {
    const draft = this.formRascunho();
    if (!draft?.status || this.isDraft(draft)) return false;

    const stored = this.store.items().find(item => item.id === draft.id);
    return !!stored && pedeMotivo(stored, this.montarPayload(draft as Row & { status: MachineStatus }));
  });

  abrirForm(row: Row): void {
    this.formAlvo = row;
    this.formRascunho.set({ ...row });
    this.formReason.set('');
    this.adjustStockChoice.set(true);
    this.stockLoadedFor = null;
    this.formAberto.set(true);
    this.syncStockCheck();
  }

  fecharForm(): void {
    this.formAberto.set(false);
    this.formRascunho.set(null);
    this.formAlvo = null;
  }

  /**
   * Salva o formulário com as respostas que ele já coletou.
   *
   * Nada abre depois daqui: o motivo e o estoque foram perguntados dentro do
   * formulário, antes do clique. Enquanto o estoque carrega, não salva — o
   * número ainda não foi mostrado, e confirmar sem ver é o que a pergunta
   * existe para impedir.
   */
  salvarForm(): void {
    const editado = this.formRascunho();
    const alvo = this.formAlvo;
    if (!editado || !alvo) return;
    if (this.stockDelta() !== 0 && this.loadingStock()) return;

    const reason = this.formNeedsReason() ? this.formReason().trim() || null : undefined;
    const adjustStock = this.stockAnswer();

    Object.assign(alvo, editado);
    const eraRascunho = this.isDraft(alvo);
    this.fecharForm();

    // Linha nova ainda não existe na API: ela tem porta própria, que valida o
    // mínimo antes de criar.
    if (eraRascunho) {
      this.saveDraft(alvo, adjustStock);
      return;
    }

    this.salvarLinha(alvo, { reason, adjustStock });
  }

  /** Atualiza um campo do rascunho do formulário. */
  editarCampo<K extends keyof Row>(campo: K, valor: Row[K]): void {
    this.formRascunho.update(atual => atual ? { ...atual, [campo]: valor } : atual);
    if (campo === 'status' || campo === 'machineId') this.syncStockCheck();
  }

  /**
   * Carrega o estoque quando a edição passa a mexer nele.
   *
   * No momento em que o status cruza a fronteira do galpão, e não no salvar:
   * o número tem que estar na tela antes de a pessoa decidir.
   */
  private syncStockCheck(): void {
    const draft = this.formRascunho();
    if (!draft || this.stockDelta() === 0) return;
    if (this.stockLoadedFor === draft.machineId) return;

    this.stockLoadedFor = draft.machineId;
    this.loadStock(draft.machineId);
  }



  clearFilters(): void {
    this.statusFilter.set([]);
    this.machineFilter.set(null);
    this.onlyLate.set(false);
    this.semPrevisao.set(false);
    this.saidaAte.set(null);
    this.search = '';
    this.onSearch();
  }

  /** Atrasado: previsão vencida e ainda não entregue. */
  isLate(row: Row): boolean {
    if (!row.previsao || row.status === MachineStatus.ENTREGUE) return false;
    return row.previsao < startOfToday();
  }

  /**
   * A previsão dita como distância: "atrasada 6 d", "hoje", "em 2 dias".
   *
   * A data sozinha obriga a fazer a conta de cabeça a cada linha, e a pergunta
   * que se faz para a tela é "quanto falta?". Entregue não conta: a data ali é
   * passado resolvido, não prazo.
   */
  relativeForecast(row: Row): string {
    if (!row.previsao) return 'sem previsão';
    if (row.status === MachineStatus.ENTREGUE) return 'entregue';

    const days = Math.round((startOfDay(row.previsao).getTime() - startOfToday().getTime()) / 86_400_000);
    if (days < 0) return `atrasada ${-days} d`;
    if (days === 0) return 'hoje';
    if (days === 1) return 'amanhã';
    return `em ${days} dias`;
  }

  // Estado de gravação por id, fora das linhas (ver o comentário em `Row`).
  private readonly savingIds = signal<ReadonlySet<string>>(new Set<string>());
  private readonly savedIds = signal<ReadonlySet<string>>(new Set<string>());

  isSaving(id: string): boolean { return this.savingIds().has(id); }
  isSaved(id: string): boolean { return this.savedIds().has(id); }

  private mark(set: 'saving' | 'saved', id: string, on: boolean): void {
    const target = set === 'saving' ? this.savingIds : this.savedIds;
    target.update(current => {
      const next = new Set(current);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  // ─── Ordenação ────────────────────────────────────────────────────────────

  /**
   * A ordem da grade.
   *
   * `null` é a ordem que a API devolve — o estado inicial, e para onde o
   * terceiro clique volta. Modelar isso como ausência, e não como um
   * `field: ''` mágico, é o que faz "voltar ao começo" ser um estado de
   * verdade.
   *
   * A ordenação vive aqui e **não** no `pSortableColumn` por duas razões: o
   * rascunho tem que continuar no topo, e a coluna Máquina mostra o nome
   * enquanto guarda o id — o sort do PrimeNG ordenaria por UUID.
   */
  readonly sortBy = signal<{ field: SortField; asc: boolean } | null>(null);

  /** Crescente → decrescente → a ordem de origem. */
  toggleSort(field: SortField): void {
    this.sortBy.update(current => {
      if (current?.field !== field) return { field, asc: true };
      return current.asc ? { field, asc: false } : null;
    });
  }

  sortIcon(field: SortField): string {
    const current = this.sortBy();
    if (current?.field !== field) return 'pi-sort-alt';
    return current.asc ? 'pi-sort-amount-up-alt' : 'pi-sort-amount-down';
  }

  ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
    const current = this.sortBy();
    if (current?.field !== field) return 'none';
    return current.asc ? 'ascending' : 'descending';
  }

  /**
   * O valor pelo qual a coluna ordena — sempre o **exibido**, nunca o cru.
   *
   * Máquina guarda um UUID e mostra o nome; Status guarda a chave do enum e
   * mostra o rótulo. Ordenar pelo campo daria uma ordem que não corresponde a
   * nada do que está na tela.
   */
  private sortKey(row: Row, field: SortField): string | number | null {
    switch (field) {
      case 'machine':   return this.machineName(row.machineId) || null;
      case 'status':    return row.status ? this.statusLabel(row.status) : null;
      case 'previsao':  return row.previsao?.getTime() ?? null;
      case 'updatedAt': return row.updatedAt ? new Date(row.updatedAt).getTime() : null;
      default:          return (row[field] as string)?.trim() || null;
    }
  }

  /**
   * Ordena a lista já filtrada.
   *
   * Três decisões dentro do comparador:
   *
   * **Vazio sempre no fim, nas duas direções.** Célula "—" é ausência de dado,
   * não valor baixo — inverter a direção para caçar os vazios é pior do que
   * deixá-los parados. É o contrário do que o PrimeNG faz, e mais uma razão
   * para a ordenação morar aqui.
   *
   * **Texto compara com `localeCompare` em pt-BR.** Acento importa em Região,
   * Técnico e nome de cliente, e `numeric` faz "Cliente 2" vir antes de
   * "Cliente 10".
   *
   * **Desempate por previsão.** Ordenar por Status cria seis baldes sobre
   * duzentas linhas; sem chave secundária, o miolo de cada balde parece
   * aleatório.
   */
  private aplicarOrdem(linhas: Row[]): Row[] {
    const ordem = this.sortBy();
    if (!ordem) return linhas;

    const direcao = ordem.asc ? 1 : -1;

    return linhas.sort((a, b) => {
      const comparado = this.compararPor(a, b, ordem.field, direcao);
      if (comparado !== 0) return comparado;
      return ordem.field === 'previsao' ? 0 : this.compararPor(a, b, 'previsao', 1);
    });
  }

  private compararPor(a: Row, b: Row, field: SortField, direcao: number): number {
    const esquerda = this.sortKey(a, field);
    const direita = this.sortKey(b, field);

    // Antes de multiplicar pela direção: vazio não participa da escala.
    if (esquerda === null && direita === null) return 0;
    if (esquerda === null) return 1;
    if (direita === null) return -1;

    if (typeof esquerda === 'number' && typeof direita === 'number') {
      return (esquerda - direita) * direcao;
    }

    return String(esquerda).localeCompare(String(direita), 'pt-BR',
      { sensitivity: 'base', numeric: true }) * direcao;
  }

  readonly rows = computed<Row[]>(() => {
    this.searchTrigger();
    const term = this.search.toLowerCase().trim();
    const statuses = this.statusFilter();
    const machine = this.machineFilter();
    const late = this.onlyLate();
    const semData = this.semPrevisao();
    const ate = this.saidaAte();

    const filtered = this.store.items()
      .map(register => this.toRow(register))
      .filter(row => {
        // A aba vem antes de tudo: entregue só aparece na aba dela.
        if ((this.aba() === 'entregues') !== (row.status === MachineStatus.ENTREGUE)) return false;
        // `row.status` é nulo só em rascunho, e rascunho não passa por aqui —
        // ele entra na lista depois do filtro. A guarda existe para o tipo.
        if (statuses.length && (!row.status || !statuses.includes(row.status))) return false;
        if (machine && row.machineId !== machine) return false;
        if (late && !this.isLate(row)) return false;
        if (semData && row.previsao) return false;

        if (ate) {
          if (row.status === MachineStatus.ENTREGUE) return false;
          if (!row.previsao) return false;
          if (new Date(row.previsao) > ate) return false;
        }

        if (!term) return true;
        // A tag entra porque é como a máquina é chamada em voz alta no galpão:
        // "a 1042" acha a linha mais rápido que o nome do cliente.
        return row.tag?.toLowerCase().includes(term)
          || row.nomeCliente?.toLowerCase().includes(term)
          || row.tecnico?.toLowerCase().includes(term)
          || row.consultor?.toLowerCase().includes(term)
          || row.regiao?.toLowerCase().includes(term)
          || row.solicitante?.toLowerCase().includes(term)
          || this.machineName(row.machineId).toLowerCase().includes(term);
      });

    // A linha nova não entra aqui: ela vive só no formulário até a API
    // confirmar, e aí chega pelo store como qualquer outra.
    //
    // `filtered` já é array novo, saído do `.filter()` — ordenar in-place nele
    // é seguro. Ordenar `store.items()` seria mutar estado que o Hub também lê.
    return this.aplicarOrdem(filtered);
  });

  readonly lateCount = computed(() =>
    this.store.items().map(r => this.toRow(r)).filter(row => this.isLate(row)).length);

  ngOnInit(): void {
    this.store.load();
    this.machineStore.load();
    this.aplicarFiltrosDaUrl();

    // 768px é o `$bp-md` do SCSS. Repetido aqui porque media query não
    // atravessa para o TypeScript — se um mudar, o outro tem que mudar junto,
    // senão a tabela e os cartões aparecem ao mesmo tempo.
    const celular = window.matchMedia('(max-width: 768px)');
    const aplicar = () => this.ehCelular.set(celular.matches);

    celular.addEventListener('change', aplicar);
    this.destroyRef.onDestroy(() => celular.removeEventListener('change', aplicar));
    aplicar();
  }

  /**
   * Lê os filtros da URL, para o Hub poder mandar a pessoa direto ao recorte.
   *
   * **Só entende o que existe.** Um status inventado na URL é ignorado, e não
   * vira lista vazia: lista vazia desenha a tela exatamente como "sem filtro
   * nenhum", então a pessoa veria a grade inteira achando que estava filtrada,
   * ou uma grade vazia sem saber por quê.
   *
   * Os filtros são os mesmos signals dos controles da toolbar, então aplicar
   * aqui já os deixa **visíveis** — quem chegou pelo link vê o recorte escrito
   * na tela, e sabe o que limpar.
   */
  private aplicarFiltrosDaUrl(): void {
    // **Observable, e não `snapshot`.** O Angular reaproveita o componente
    // quando só os query params mudam: com o snapshot lido uma vez no
    // `ngOnInit`, o primeiro link do Hub funcionava e o segundo não fazia nada.
    // A tela ficava com o filtro antigo, e o clique parecia quebrado.
    const inscricao = this.route.queryParamMap.subscribe(params => this.aplicar(params));
    this.destroyRef.onDestroy(() => inscricao.unsubscribe());
  }

  /**
   * A URL é a fonte da verdade a cada navegação: o que não vem nela é
   * **limpo**, não mantido. Sem isso, ir de `?status=X` para `?maquina=Y`
   * deixaria o status antigo aplicado por cima do recorte novo.
   */
  private aplicar(params: ParamMap): void {

    const status = (params.get('status') ?? '')
      .split(',')
      .map(valor => valor.trim().toUpperCase())
      .filter((valor): valor is MachineStatus =>
        Object.values(MachineStatus).includes(valor as MachineStatus));

    // `?status=ENTREGUE` (o Hub manda) abre a aba das entregues; o chip
    // Entregue não existe mais na fileira.
    this.aba.set(status.includes(MachineStatus.ENTREGUE) ? 'entregues' : 'andamento');
    this.statusFilter.set(status.filter(s => s !== MachineStatus.ENTREGUE));
    this.machineFilter.set(params.get('maquina') || null);
    this.onlyLate.set(params.get('atrasadas') === '1');
    this.semPrevisao.set(params.get('semPrevisao') === '1');

    // Data inválida vira "sem filtro", pelo mesmo motivo do status inventado —
    // e o `parseDateOnly` já devolve `null` nesse caso.
    this.saidaAte.set(parseDateOnly(params.get('ate')));
  }

  refresh(): void {
    this.store.refresh();
    this.machineStore.refresh();
  }

  onSearch(): void {
    this.searchTrigger.update(v => v + 1);
  }

  private toRow(register: MachineRegister): Row {
    return { ...register, previsao: parseDateOnly(register.previsaoEntrega) };
  }

  machineName(machineId: string): string {
    return this.machineStore.nameOf(machineId);
  }

  statusLabel(status: MachineStatus): string {
    return MACHINE_STATUS_LABEL[status] ?? status;
  }

  statusClass(status: MachineStatus): string {
    return `status-chip status-chip--${MACHINE_STATUS_SEVERITY[status] ?? 'neutral'}`;
  }

  /**
   * O ícone do chip.
   *
   * Existe para o status não depender só da cor: em escala de cinza, ou para
   * quem não distingue vermelho de verde, os seis chips ficariam parecidos
   * demais. O `?? ''` cobre um status que a API passe a mandar antes de a tela
   * conhecer — sem ícone é melhor que com o ícone errado.
   */
  statusIcon(status: MachineStatus): string {
    return MACHINE_STATUS_ICON[status] ?? '';
  }

  stamp(value: string | null | undefined): string {
    return formatStampBr(value, true);
  }

  /**
   * A célula mostra a última alteração porque é o que se pergunta na prática
   * ("quem mudou isso?"); a criação fica no tooltip para não gastar coluna.
   */
  auditTooltip(row: Row): string {
    if (!row.createdAt) return 'Sem registro de criação.';
    return `Criado por ${row.createdBy || 'desconhecido'} em ${formatStampBr(row.createdAt)}`;
  }

  isDraft(row: Row): boolean {
    return row.id.startsWith('draft-');
  }

  // ─── Linha nova ───────────────────────────────────────────────────────────

  /**
   * A linha nasce no formulário e só vai para a API quando alguém salva —
   * assim ninguém cria registro por engano.
   *
   * **Sem máquina escolhida.** Ela nascia com a primeira da lista, e quem não
   * reparasse criava a linha na máquina errada. A escolha é um ato, como o
   * status.
   */
  addRow(): void {
    this.abrirForm({
      id: `draft-${Date.now()}`,
      machineId: '',
      nomeCliente: '',
      tag: '',
      regiao: '',
      solicitante: '',
      status: null,
      Observacao: '',
      previsaoEntrega: null,
      consultor: '',
      tecnico: '',
      previsao: null,
    });
  }

  /**
   * A máquina e o status, e mais nada.
   *
   * O cliente era exigido também, e isso ficou errado quando o modelo se
   * fechou: uma linha **é** uma máquina física, então linha sem cliente é
   * legítima — é máquina no galpão que ninguém prometeu ainda, e ela cai em
   * "Sem previsão" esperando destino.
   *
   * O status entrou porque o padrão anterior mentia: a linha nascia
   * `DISPONIVEL`, e criar uma máquina ainda não comprada exigia lembrar de
   * trocar a célula. Agora a escolha é um ato.
   *
   * **É um type predicate**, e isso não é enfeite: o `if (!canSaveDraft(row))`
   * de `saveDraft` passa a estreitar o tipo no resto do método, então o status
   * nulo some dali sem um único `!`. O tipo diz o que a tela diz — o botão
   * habilitado É a prova de que há status.
   */
  canSaveDraft(row: Row): row is SavableDraft {
    return !!row.machineId && !!row.status;
  }

  /** Por que o botão de salvar está desabilitado — o botão sozinho não conta. */
  saveDraftHint(row: Row): string {
    if (!row.machineId) return 'Escolha a máquina para salvar';
    if (!row.status) return 'Escolha o status para salvar';
    return '';
  }

  /**
   * Cria a linha. O `adjustStock` é a resposta que o formulário já coletou;
   * ausente, a API lê `false` e não lança nada no estoque.
   */
  saveDraft(row: Row, adjustStock?: boolean): void {
    if (!this.canSaveDraft(row) || this.isSaving(row.id)) return;

    const payload: CreateMachineRegister = {
      machineId: row.machineId,
      nomeCliente: row.nomeCliente.trim(),
      tag: row.tag?.trim() || null,
      regiao: row.regiao ?? '',
      solicitante: row.solicitante ?? '',
      status: row.status,
      Observacao: row.Observacao ?? '',
      previsaoEntrega: this.toLocalDateTime(row.previsao),
      consultor: row.consultor ?? '',
      tecnico: row.tecnico ?? '',
    };

    // Linha nova nascendo em estoque é uma máquina entrando no galpão; fora
    // dele, o campo nem vai.
    if (stockDeltaFor(null, row.status) !== 0 && adjustStock !== undefined) {
      payload.adjustStock = adjustStock;
    }

    this.mark('saving', row.id, true);

    this.store.create(payload).subscribe({
      next: () => {
        this.mark('saving', row.id, false);
        this.messageService.add({ severity: 'success', summary: 'Linha incluída', detail: payload.nomeCliente });
      },
      error: (err: HttpErrorResponse) => {
        this.mark('saving', row.id, false);
        this.showError(err);
      },
    });
  }

  // ─── O estoque atual ──────────────────────────────────────────────────────

  /**
   * O estoque atual vem do último movimento, como na tela de movimentação.
   *
   * Carregado quando o formulário passa a mexer no estoque, e não junto da
   * grade: seria um GET por linha numa tela de centenas, para um número que só
   * interessa nesse instante.
   */
  private loadStock(machineId: string): void {
    const machine = this.machineStore.items().find(item => item.id === machineId);

    this.currentStock.set(0);

    if (!machine) {
      this.loadingStock.set(false);
      return;
    }

    this.loadingStock.set(true);
    this.inventoryService.getInventoryMovementsByProduct(machine.systemCode).subscribe({
      next: (list) => {
        // Por `createdAt`, não por `movementDate`: a segunda não tem hora, e
        // dois lançamentos do mesmo dia empatam. Era o que fazia a conta
        // mostrar um estoque de partida errado.
        const sorted = [...(list ?? [])].sort((a, b) =>
          (a.createdAt ?? a.movementDate).localeCompare(b.createdAt ?? b.movementDate));
        this.currentStock.set(sorted.length ? sorted[sorted.length - 1].quantity : 0);
        this.loadingStock.set(false);
      },
      // 404 é máquina sem movimento nenhum: estoque zero, não erro.
      error: () => this.loadingStock.set(false),
    });
  }

  /** O nome da máquina do formulário, para a pergunta do estoque. */
  stockMachineName(): string {
    const draft = this.formRascunho();
    return (draft && this.machineName(draft.machineId)) || 'esta máquina';
  }

  // ─── Gravação ─────────────────────────────────────────────────────────────

  /**
   * Monta o corpo do PUT a partir da linha.
   *
   * **Um construtor só, e é de propósito.** A API não tem PATCH — todo
   * salvamento manda os nove campos —, e a tela tem duas portas de edição: o
   * calendário da previsão e o formulário. Dois construtores divergiriam no dia
   * em que a API ganhasse um campo, e o caminho menos usado passaria meses
   * mandando o campo faltando sem ninguém notar.
   */
  private montarPayload(row: Row & { status: MachineStatus }): UpdateMachineRegister {
    return {
      nomeCliente: row.nomeCliente ?? '',
      tag: row.tag?.trim() || null,
      regiao: row.regiao ?? '',
      solicitante: row.solicitante ?? '',
      status: row.status,
      Observacao: row.Observacao ?? '',
      previsaoEntrega: this.toLocalDateTime(row.previsao),
      consultor: row.consultor ?? '',
      tecnico: row.tecnico ?? '',
    };
  }

  /**
   * O caminho único de gravação de uma linha existente.
   *
   * As perguntas já foram feitas por quem chama — o formulário e o calendário
   * mostram o motivo e o estoque ANTES do clique —, e chegam aqui como
   * respostas. O que continua aqui são as regras, e **nenhuma é decorativa**:
   * quem chamar o service por fora pula todas em silêncio, e a perda só aparece
   * semanas depois, no Hub, como máquina que adiou sem justificativa.
   *
   * 1. `hasChanges` — sem ele, abrir e salvar sem mexer vira um PUT;
   * 2. `pedeMotivo` — o motivo só vai quando a edição o pede, e vale para ela
   *    inteira;
   * 3. `stockDeltaFor` — o `adjustStock` só vai quando o status cruza a
   *    fronteira do galpão.
   */
  salvarLinha(row: Row, answers: { reason?: string | null; adjustStock?: boolean } = {}): void {
    if (!row || this.isDraft(row) || this.isSaving(row.id)) return;

    // Linha gravada sempre tem status — a API o exige. A guarda é a invariante
    // virando código.
    if (!row.status) return;

    const payload = this.montarPayload(row as Row & { status: MachineStatus });

    const stored = this.store.items().find(item => item.id === row.id);
    if (stored && !hasChanges(stored, payload)) return;

    if (stored && pedeMotivo(stored, payload)) {
      payload.motivoAlteracaoPrevisao = answers.reason?.trim() || null;
    }

    const delta = stored ? stockDeltaFor(stored.status, payload.status) : 0;
    if (delta !== 0 && answers.adjustStock !== undefined) {
      payload.adjustStock = answers.adjustStock;
    }

    this.gravar(row, payload);
  }

  private gravar(row: Row, payload: UpdateMachineRegister): void {
    this.mark('saving', row.id, true);
    this.mark('saved', row.id, false);

    this.registerService.update(row.id, payload).subscribe({
      next: () => {
        this.mark('saving', row.id, false);
        this.mark('saved', row.id, true);
        // `previsao` é da view, não do contrato — o store guarda o registro puro.
        const { previsao, ...register } = row;
        this.store.upsert({ ...register, ...payload });
        setTimeout(() => this.mark('saved', row.id, false), 1500);
      },
      error: (err: HttpErrorResponse) => {
        this.mark('saving', row.id, false);
        this.showError(err);
        // Recarrega para a tela não ficar mostrando um valor que não gravou.
        this.store.refresh();
      },
    });
  }

  // ─── Excluir ──────────────────────────────────────────────────────────────

  /**
   * O pedido de exclusão, e o que ele leva junto.
   *
   * A exclusão de verdade leva **o histórico de alterações** (`ON DELETE
   * CASCADE` na V82), e é isso que a pergunta precisa dizer: o que some não é
   * só a linha. Mora num `pk-dialog` com texto do template — a mensagem era
   * HTML montado em string, com o nome do cliente dentro.
   */
  readonly deleteTarget = signal<Row | null>(null);

  /**
   * Apagar não baixa o estoque de propósito: apagar é "essa linha nunca
   * deveria ter existido". Se a máquina está no galpão, o certo é mudar o
   * status. Mas quem clica precisa saber disso antes, não depois.
   */
  readonly deleteCountsInStock = computed(() => {
    const status = this.deleteTarget()?.status;
    return !!status && IN_STOCK_STATUSES.includes(status);
  });

  /** Rascunho não pergunta: é uma linha que nunca existiu no banco. */
  deleteRow(row: Row): void {
    if (this.isDraft(row)) {
      this.fecharForm();
      return;
    }
    this.deleteTarget.set(row);
  }

  confirmDelete(): void {
    const row = this.deleteTarget();
    if (!row) return;
    this.deleteTarget.set(null);

    this.store.deleteById(row.id).subscribe({
      next: () => {
        if (this.formRascunho()?.id === row.id) this.fecharForm();
        this.messageService.add({ severity: 'success', summary: 'Linha removida', detail: row.nomeCliente });
      },
      error: (err: HttpErrorResponse) => this.showError(err),
    });
  }

  /** A API recebe LocalDateTime; a planilha só tem data. Meia-noite local. */
  private toLocalDateTime(date: Date | null): string | null {
    if (!date) return null;
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;
  }

  private showError(err: HttpErrorResponse): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Não foi possível salvar',
      detail: err.status === 0 ? 'Sem conexão com o servidor.'
        : typeof err.error === 'string' ? err.error : 'Erro inesperado.',
    });
  }
}

function startOfToday(): Date {
  return startOfDay(new Date());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Compara a célula editada com o que está no store.
 *
 * A data é comparada só pela parte do dia: a API devolve `LocalDateTime` e o
 * campo é uma data — a hora sempre bate em zero, mas o formato da string pode
 * variar e faria toda linha parecer suja.
 */
function hasChanges(stored: MachineRegister, payload: UpdateMachineRegister): boolean {
  return (stored.nomeCliente ?? '') !== payload.nomeCliente
    || (stored.tag ?? null) !== payload.tag
    || (stored.regiao ?? '') !== payload.regiao
    || (stored.solicitante ?? '') !== payload.solicitante
    || stored.status !== payload.status
    || (stored.Observacao ?? '') !== payload.Observacao
    || (stored.consultor ?? '') !== payload.consultor
    || (stored.tecnico ?? '') !== payload.tecnico
    || dayPart(stored.previsaoEntrega) !== dayPart(payload.previsaoEntrega);
}

/**
 * Vale perguntar o motivo desta edição?
 *
 * Três exclusões, e cada uma tem dono:
 *
 * **Observação** não entra no histórico — decisão do time. Perguntar ali seria
 * pedir uma justificativa que a API descarta em silêncio, porque ela só grava
 * motivo junto de um campo alterado.
 *
 * **Status** não pergunta, embora seja registrado. Reservar uma máquina não é
 * assunto, e a grade se edita o dia todo: um diálogo aí apareceria dezenas de
 * vezes sem nada a dizer. Quando o status mexe no estoque, quem pergunta é o
 * diálogo de estoque, que tem algo concreto a mostrar.
 *
 * **Campo que estava vazio** não entra. Preencher é completar cadastro, não
 * alterar — não há nada de onde ter saído, e não há decisão a justificar. Vale
 * para os sete, e não só para a previsão: era a regra do adiamento, e ela
 * generalizou junto com o histórico.
 */
function pedeMotivo(stored: MachineRegister, payload: UpdateMachineRegister): boolean {
  return alterou(stored.nomeCliente, payload.nomeCliente)
    || alterou(stored.tag, payload.tag)
    || alterou(stored.regiao, payload.regiao)
    || alterou(stored.solicitante, payload.solicitante)
    || alterou(stored.consultor, payload.consultor)
    || alterou(stored.tecnico, payload.tecnico)
    || alterou(dayPart(stored.previsaoEntrega), dayPart(payload.previsaoEntrega));
}

/**
 * Mudou **tendo valor antes**.
 *
 * Vazio e nulo são a mesma ausência, aqui como na API: um input limpo devolve
 * `""` onde o banco tem `null`, e tratá-los como coisas diferentes faria toda
 * visita a uma célula em branco parecer alteração.
 *
 * Apagar CONTA — é alteração, e a mais grave no caso da previsão, porque a
 * máquina some das próximas saídas sem ninguém perceber.
 */
function alterou(antes: string | null | undefined, depois: string | null | undefined): boolean {
  const anterior = antes?.trim() || null;
  if (anterior === null) return false;
  return anterior !== (depois?.trim() || null);
}

function dayPart(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}