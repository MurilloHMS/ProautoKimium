import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';

import {
  AlignResult,
  MachineDivergence,
  divergenceOf,
  MACHINE_STATUS_ICON,
  MACHINE_STATUS_LABEL,
  StatusSeverity,
  MACHINE_STATUS_SEVERITY,
  MACHINE_TYPE_LABEL,
  MachineStatus,
  MachineType,
} from '../../../../domain/models/prostock/machine.model';
import { MachineRegister, ScheduleSlip } from '../../../../domain/models/prostock/register.model';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { parseDateOnly } from '../../../../domain/utils/date-only';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import {
  CalendarDayEvent,
  CalendarLegendItem,
  CalendarTone,
  PkCalendarComponent,
} from '../../../theme/ProautoKimium/pk-calendar/pk-calendar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';

interface Slice {
  label: string;
  count: number;
  percent: number;
  severity: string;
}

/** Uma implantação no dia do calendário. */
interface DayEntry {
  register: MachineRegister;
  machine: string;
  label: string;
  statusLabel: string;
  severity: string;
  late: boolean;
}

/**
 * Quantas linhas um cartão do Hub mostra antes de mandar para a tela.
 *
 * O Hub responde "tem alguma coisa?"; a tela responde "quais?". Cinco é o que
 * cabe sem o cartão virar rolagem, e o corte é sempre anunciado — corte em
 * silêncio faz a pessoa acreditar que viu tudo.
 */
const HUB_LIST_LIMIT = 5;

/**
 * A cor de cada severidade na rosca.
 *
 * **Existe porque montar o nome do token por concatenação quebrou.** A primeira
 * versão fazia `var(--app-${severidade})`, e `--app-neutral` **não existe** — o
 * tema chama de `--app-text-muted`. Uma parada de cor inválida invalida o
 * `conic-gradient` INTEIRO, então a rosca não aparecia: sem erro no console,
 * sem falha de build, sem teste vermelho. Só um círculo em branco.
 *
 * Escrito à mão, um token errado não compila: o TypeScript exige as seis
 * chaves de `StatusSeverity`.
 */
const COR_DA_SEVERIDADE: Record<StatusSeverity, string> = {
  success: 'var(--app-success)',
  info:    'var(--app-info)',
  warning: 'var(--app-warning)',
  work:    'var(--app-work)',
  danger:  'var(--app-danger)',
  neutral: 'var(--app-text-muted)',
};

/** Uma fatia da rosca: leva a chave do enum, para virar link, e o ícone. */
interface RoscaFatia {
  status: MachineStatus;
  label: string;
  icon: string;
  count: number;
  percent: number;
  severity: StatusSeverity;
}

/** Uma máquina e a quebra das programações dela por status. */
interface MaquinaResumo {
  machineId: string;
  nome: string;
  total: number;
  partes: {
    status: MachineStatus;
    label: string;
    icon: string;
    severity: StatusSeverity;
    count: number;
  }[];
}

/**
 * Depois de trinta dias vencida, a máquina para de ser "próxima saída".
 *
 * A lista limitava sete dias para frente e nada para trás, então uma previsão
 * vencida há seis meses ficava lá para sempre e ia acumulando. Passou disso, é
 * problema parado — e o lugar dele é a faixa "Precisa de você", que já mostra.
 */
const LATE_CUTOFF_DAYS = 30;

interface UpcomingExit {
  register: MachineRegister;
  machine: string;
  date: Date;
  daysLeft: number;
  late: boolean;
}

/**
 * Máquina no galpão sem data de saída.
 *
 * `diasParada` vem da auditoria, e é o que faz a lista valer: um nome sozinho
 * não diz nada, "há 40 dias sem previsão" diz. Sem `createdAt` — registro
 * importado antes da V74 — fica nulo e a linha não mente inventando idade.
 */
interface Parada {
  register: MachineRegister;
  machine: string;
  diasParada: number | null;
}

/**
 * Hub das Máquinas.
 *
 * Tudo aqui sai de duas listas que já estão em memória (`MachineStore` e
 * `MachineRegisterStore`) — nenhum endpoint novo, e mudar um status na
 * Programação mexe nestes números na hora.
 *
 * As barras são CSS puro, como no Painel de RH: o projeto não tem biblioteca de
 * gráfico e não vale acrescentar uma por causa de duas distribuições.
 */
@Component({
  selector: 'app-machine-hub',
  standalone: true,
  imports: [
    CommonModule, RouterLink, PageHeaderComponent, PkDialogComponent, PkCalendarComponent,
    PkButtonComponent, ConfirmDialogModule, Toast,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './machine-hub.component.html',
  styleUrl: './machine-hub.component.scss',
})
export class MachineHubComponent implements OnInit {

  private readonly machineStore = inject(MachineStore);
  private readonly machineService = inject(MachineService);
  private readonly registerService = inject(RegisterService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly registerStore = inject(MachineRegisterStore);

  readonly loading = computed(() => this.machineStore.loading() || this.registerStore.loading());

  readonly totalMachines = computed(() => this.machineStore.items().length);
  readonly totalRegisters = computed(() => this.registerStore.items().length);

  private readonly byStatus = computed(() => {
    const counts = new Map<MachineStatus, number>();
    for (const register of this.registerStore.items()) {
      counts.set(register.status, (counts.get(register.status) ?? 0) + 1);
    }
    return counts;
  });

  readonly available = computed(() => this.byStatus().get(MachineStatus.DISPONIVEL) ?? 0);
  readonly delivered = computed(() => this.byStatus().get(MachineStatus.ENTREGUE) ?? 0);
  readonly inRepair = computed(() => this.byStatus().get(MachineStatus.REFORMA) ?? 0);

  /** Travado esperando compra — o status que mais empurra entrega para frente. */
  readonly waitingPurchase = computed(() => this.byStatus().get(MachineStatus.AGUARDANDO_AQUISICAO) ?? 0);

  /** Distribuição dos registros por status, do maior para o menor. */
  readonly statusSlices = computed<Slice[]>(() => {
    const total = this.totalRegisters() || 1;
    return [...this.byStatus().entries()]
      .map(([status, count]) => ({
        label: MACHINE_STATUS_LABEL[status] ?? status,
        count,
        percent: Math.round((count / total) * 100),
        severity: MACHINE_STATUS_SEVERITY[status] ?? 'neutral',
      }))
      .sort((a, b) => b.count - a.count);
  });

  // ─── A rosca por status ───────────────────────────────────────────────────

  /**
   * As fatias da rosca, já com a chave do enum e o ícone.
   *
   * O `statusSlices` acima leva só o rótulo, que serve para a barra mas não
   * para cá: a fatia precisa do status para virar link, e do ícone porque a cor
   * sozinha não sustenta seis categorias — em escala de cinza, ou para quem não
   * separa vermelho de verde, as seis viram o mesmo tom.
   */
  readonly roscaFatias = computed<RoscaFatia[]>(() => {
    const total = this.totalRegisters() || 1;

    return [...this.byStatus().entries()]
      .map(([status, count]) => ({
        status,
        label: MACHINE_STATUS_LABEL[status] ?? status,
        icon: MACHINE_STATUS_ICON[status] ?? '',
        count,
        percent: Math.round((count / total) * 100),
        severity: MACHINE_STATUS_SEVERITY[status] ?? 'neutral',
      }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * O `conic-gradient` da rosca, montado a partir das fatias.
   *
   * Usa **graus acumulados e não porcentagem arredondada**: seis fatias
   * arredondadas somam 99% ou 101%, e a rosca fecharia com uma fresta ou com
   * uma fatia comendo a vizinha.
   */
  readonly roscaGradiente = computed(() => {
    const fatias = this.roscaFatias();
    if (!fatias.length) return 'var(--app-surface-2)';

    const total = this.totalRegisters() || 1;
    let grau = 0;

    const paradas = fatias.map(fatia => {
      const inicio = grau;
      grau += (fatia.count / total) * 360;
      return `${COR_DA_SEVERIDADE[fatia.severity]} ${inicio}deg ${grau}deg`;
    });

    return `conic-gradient(${paradas.join(', ')})`;
  });

  // ─── Programações por máquina ─────────────────────────────────────────────

  /**
   * Quantas programações cada máquina tem, e em que status.
   *
   * Uma linha da programação **é uma unidade da máquina** — então "NET300: 12"
   * é a contagem de linhas com aquele `machineId`.
   *
   * Só máquinas **com** programação: quem tem zero não ocupa espaço, porque a
   * lista acompanha o trabalho e não o cadastro.
   *
   * O mapa de nomes é montado **uma vez**. O `machineStore.nameOf()` faz um
   * `find` linear a cada chamada, e chamá-lo por registro custaria
   * registros × máquinas — o Hub já paga esse preço em três lugares.
   */
  readonly porMaquina = computed<MaquinaResumo[]>(() => {
    const nomes = new Map(this.machineStore.items().map(m => [m.id, m.name]));
    const agrupado = new Map<string, Map<MachineStatus, number>>();

    for (const registro of this.registerStore.items()) {
      const porStatus = agrupado.get(registro.machineId) ?? new Map<MachineStatus, number>();
      porStatus.set(registro.status, (porStatus.get(registro.status) ?? 0) + 1);
      agrupado.set(registro.machineId, porStatus);
    }

    return [...agrupado.entries()]
      .map(([machineId, porStatus]) => ({
        machineId,
        nome: nomes.get(machineId) ?? machineId,
        total: [...porStatus.values()].reduce((soma, n) => soma + n, 0),
        partes: [...porStatus.entries()]
          .map(([status, count]) => ({
            status,
            label: MACHINE_STATUS_LABEL[status] ?? status,
            icon: MACHINE_STATUS_ICON[status] ?? '',
            severity: MACHINE_STATUS_SEVERITY[status] ?? 'neutral',
            count,
          }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  });

  /** Corta em 5 e anuncia, como as listas de saídas e paradas já fazem. */
  readonly visibleMaquinas = computed(() => this.porMaquina().slice(0, HUB_LIST_LIMIT));
  readonly hiddenMaquinas = computed(() => this.porMaquina().length - this.visibleMaquinas().length);

  // ─── O que vence ──────────────────────────────────────────────────────────

  /**
   * Três números: atrasadas, esta semana, próxima.
   *
   * **Não é gráfico de propósito.** O Hub já tem calendário e "Próximas
   * saídas", que respondem *quando* — estes três respondem *quanto aperta*, que
   * é a pergunta que os outros dois não respondem. Um terceiro desenho do mesmo
   * dado dividiria a atenção sem acrescentar.
   */
  readonly prazos = computed(() => {
    const hoje = startOfToday();

    // Domingo fecha a semana, como no calendário do Hub.
    const fimDaSemana = new Date(hoje);
    fimDaSemana.setDate(hoje.getDate() + (7 - hoje.getDay()) % 7);

    const fimDaProxima = new Date(fimDaSemana);
    fimDaProxima.setDate(fimDaSemana.getDate() + 7);

    let atrasadas = 0;
    let estaSemana = 0;
    let proxima = 0;

    for (const registro of this.registerStore.items()) {
      if (registro.status === MachineStatus.ENTREGUE || !registro.previsaoEntrega) continue;

      const data = parseDateOnly(registro.previsaoEntrega);
      if (!data) continue;

      if (data < hoje) atrasadas++;
      else if (data <= fimDaSemana) estaSemana++;
      else if (data <= fimDaProxima) proxima++;
    }

    return { atrasadas, estaSemana, proxima, fimDaProxima };
  });

  /** Distribuição do catálogo por tipo de máquina. */
  readonly typeSlices = computed<Slice[]>(() => {
    const counts = new Map<MachineType, number>();
    for (const machine of this.machineStore.items()) {
      // Máquina é produto: o tipo é opcional e fica nulo em quem foi cadastrado
      // pela tela de produtos sem preencher. Sem tipo, fora da distribuição —
      // um fatia "null" não diria nada a ninguém.
      if (!machine.machineType) continue;
      counts.set(machine.machineType, (counts.get(machine.machineType) ?? 0) + 1);
    }
    const total = this.totalMachines() || 1;

    return [...counts.entries()]
      .map(([type, count]) => ({
        label: MACHINE_TYPE_LABEL[type] ?? type,
        count,
        percent: Math.round((count / total) * 100),
        severity: 'neutral',
      }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Próximas saídas — o insight que a planilha não dá sem ler linha a linha.
   * Entra o que vence nos próximos 7 dias, mais o que já venceu e não saiu.
   */
  readonly upcoming = computed<UpcomingExit[]>(() => {
    const today = startOfToday();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);

    return this.registerStore.items()
      .filter(register => register.status !== MachineStatus.ENTREGUE && register.previsaoEntrega)
      .map(register => {
        const date = parseDateOnly(register.previsaoEntrega)!;
        const daysLeft = Math.round((date.getTime() - today.getTime()) / 86_400_000);
        return {
          register,
          machine: this.machineStore.nameOf(register.machineId),
          date,
          daysLeft,
          late: daysLeft < 0,
        };
      })
      .filter(item => item.date <= limit && item.daysLeft >= -LATE_CUTOFF_DAYS)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  readonly lateCount = computed(() => this.upcoming().filter(item => item.late).length);

  readonly visibleUpcoming = computed(() => this.upcoming().slice(0, HUB_LIST_LIMIT));
  readonly hiddenUpcoming = computed(() => this.upcoming().length - this.visibleUpcoming().length);

  /**
   * O complemento de "Próximas saídas": o que está parado.
   *
   * Aquela lista filtra por **ter** previsão; esta pega justamente quem não
   * tem. São as máquinas fisicamente no galpão sem compromisso — o hub mostrava
   * só o que ia sair, e nunca o que estava encalhado.
   *
   * `ENTREGUE` fica de fora porque já saiu: sem previsão e entregue não é
   * máquina parada, é registro histórico.
   *
   * Mais antiga no topo. Uma máquina sem previsão há dois meses é o problema;
   * a que chegou ontem ainda não é.
   */
  readonly paradas = computed<Parada[]>(() => {
    const hoje = startOfToday();

    return this.registerStore.items()
      .filter(register => !register.previsaoEntrega && register.status !== MachineStatus.ENTREGUE)
      .map(register => {
        const desde = parseDateOnly(register.createdAt ?? null);
        return {
          register,
          machine: this.machineStore.nameOf(register.machineId),
          diasParada: desde
            ? Math.round((hoje.getTime() - desde.getTime()) / 86_400_000)
            : null,
        };
      })
      .sort((a, b) => (b.diasParada ?? -1) - (a.diasParada ?? -1));
  });

  readonly visibleParadas = computed(() => this.paradas().slice(0, HUB_LIST_LIMIT));
  readonly hiddenParadas = computed(() => this.paradas().length - this.visibleParadas().length);

  // ─── Precisa de você ──────────────────────────────────────────────────────
  //
  // A mesma pergunta que organiza a home do ERP. O Hub abria com seis KPIs —
  // referência pura, nada para fazer — e enterrava o que pede ação no meio da
  // pilha.
  //
  // É **linha, não cartão**: cartão ocupa altura fixa mesmo vazio, linha some
  // quando não tem o que dizer. É o que permite a faixa inteira desaparecer num
  // dia bom, e faixa vazia aqui é a meta, não defeito.

  readonly attention = computed<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    const atrasadas = this.upcoming().filter(item => item.late);
    if (atrasadas.length) {
      items.push({
        tone: 'danger',
        lead: `${atrasadas.length} ${plural(atrasadas.length, 'máquina', 'máquinas')} com previsão vencida`,
        // Os dois piores por nome: a contagem sozinha não diz por onde começar.
        // `daysLeft` é negativo quando venceu — o sinal já foi usado para
        // marcar `late`, aqui interessa só o tamanho do atraso.
        detail: atrasadas.slice(0, 2)
          .map(item => {
            const dias = Math.abs(item.daysLeft);
            return `${item.register.nomeCliente?.trim() || 'sem cliente'} há ${dias} ${plural(dias, 'dia', 'dias')}`;
          })
          .join(' · '),
        cta: 'Ver na programação',
        link: '/stock/programacao',
      });
    }

    const paradas = this.paradas();
    if (paradas.length) {
      const maisAntiga = paradas[0]?.diasParada;
      items.push({
        tone: 'warning',
        lead: `${paradas.length} ${plural(paradas.length, 'máquina', 'máquinas')} sem previsão`,
        detail: maisAntiga
          ? `a mais antiga parada há ${maisAntiga} ${plural(maisAntiga, 'dia', 'dias')}`
          : 'sem data de saída marcada',
        cta: 'Programar',
        link: '/stock/programacao',
      });
    }

    const divergentes = this.divergent();
    if (divergentes.length) {
      items.push({
        tone: 'info',
        lead: `${divergentes.length} ${plural(divergentes.length, 'máquina', 'máquinas')} com estoque e programação divergentes`,
        detail: divergentes.slice(0, 2)
          .map(item => {
            const gap = divergenceOf(item);
            return `${item.name} ${gap > 0 ? 'sobra' : 'falta'} ${Math.abs(gap)}`;
          })
          .join(' · '),
        cta: 'Conciliar',
        link: '/stock/movements',
      });
    }

    return items;
  });

  // ─── As duas contagens ────────────────────────────────────────────────────
  //
  // Estoque e programação contam a mesma coisa por caminhos diferentes. A
  // conciliação fechou os caminhos normais, mas nada avisava quando eles
  // separavam — e a divergência só aparecia contando na mão.

  readonly divergences = signal<MachineDivergence[]>([]);
  readonly loadingDivergences = signal(false);

  readonly divergent = computed(() =>
    this.divergences().filter(item => divergenceOf(item) !== 0));

  /** Quando tudo bate, o cartão vira uma linha de confirmação, não some. */
  readonly allMatch = computed(() =>
    this.divergences().length > 0 && this.divergent().length === 0);

  /**
   * Quantas fecham.
   *
   * O cartão mostra **só quem não bate** — isso não é corte por espaço, é o que
   * ele existe para mostrar. Com cinquenta máquinas e duas divergentes,
   * ninguém quer ler quarenta e oito linhas de `✓` para achar as duas. Este
   * número vira a linha que preserva a informação sem gastar a tela.
   */
  readonly matchingCount = computed(() =>
    this.divergences().length - this.divergent().length);

  // ─── Acertar uma divergência ──────────────────────────────────────────────
  //
  // A conciliação normal exige um delta e serve a quem está lançando estoque
  // agora. Uma divergência que já estava lá não tinha como ser consertada — a
  // tela mostrava o problema e não tinha botão.
  //
  // Aqui não há escolha a fazer: uma linha É uma máquina física, então a
  // programação é a verdade e o acerto segue dela. Mas a pessoa vê o que vai
  // acontecer antes, porque criar 35 linhas de uma vez não é reversível com um
  // Ctrl+Z.

  readonly aligning = signal<string | null>(null);

  isAligning(item: MachineDivergence): boolean {
    return this.aligning() === item.systemCode;
  }

  /** O que o botão vai fazer, dito antes de fazer. */
  alignSummary(item: MachineDivergence): string {
    const gap = divergenceOf(item);
    return gap > 0
      ? `Criar ${gap} ${plural(gap, 'programação', 'programações')} sem previsão para ${item.name}?`
      : `Ajustar o estoque de ${item.name} de ${item.stock} para ${item.scheduled}?`;
  }

  align(item: MachineDivergence): void {
    if (this.aligning()) return;

    const gap = divergenceOf(item);
    const detalhe = gap > 0
      ? `Vão nascer <strong>${gap}</strong> ${plural(gap, 'programação', 'programações')} `
        + 'com status Disponível, sem cliente e sem previsão. '
        + 'Elas aparecem em <strong>Sem previsão</strong>, esperando destino.'
      : `O estoque em movimentações vai de <strong>${item.stock}</strong> para `
        + `<strong>${item.scheduled}</strong>, que é o número de máquinas que a `
        + 'programação diz existir. Nenhuma linha é apagada.';

    this.confirmationService.confirm({
      header: 'Acertar os dois números',
      message: `${this.alignSummary(item)}<br><br>${detalhe}`,
      icon: 'pi pi-sync',
      acceptLabel: 'Acertar',
      rejectLabel: 'Cancelar',
      accept: () => this.confirmAlign(item),
    });
  }

  private confirmAlign(item: MachineDivergence): void {
    this.aligning.set(item.systemCode);

    this.machineService.align(item.systemCode).subscribe({
      next: (result) => {
        this.aligning.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Números acertados',
          detail: result.created > 0
            ? `${result.created} ${plural(result.created, 'programação criada', 'programações criadas')} para ${result.name}.`
            : `Estoque de ${result.name} ajustado para ${result.stockAfter}.`,
        });
        // As duas listas mudaram: a programação ganhou linhas, ou o estoque
        // mudou. Recarregar as duas é mais barato que adivinhar o novo estado.
        this.registerStore.refresh();
        this.loadDivergences();
      },
      error: (err: HttpErrorResponse) => {
        this.aligning.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'Não foi possível acertar',
          detail: typeof err.error === 'string' ? err.error : 'Erro inesperado.',
        });
      },
    });
  }

  differenceOf(item: MachineDivergence): number {
    return divergenceOf(item);
  }

  /** O sinal já é mostrado separado, então o template pede só o tamanho. */
  abs(value: number): number {
    return Math.abs(value);
  }

  private loadDivergences(): void {
    this.loadingDivergences.set(true);
    this.machineService.divergences().subscribe({
      next: (list) => {
        this.divergences.set(list ?? []);
        this.loadingDivergences.set(false);
      },
      // Silencioso de propósito: é um cartão de apoio, e derrubar o Hub inteiro
      // por causa dele seria pior que não mostrá-lo.
      error: () => {
        this.divergences.set([]);
        this.loadingDivergences.set(false);
      },
    });
  }

  // ─── Adiamentos do mês ────────────────────────────────────────────────────
  //
  // A tabela existe desde a Parte 2 e ninguém lia o conjunto. Uma máquina
  // adiada quatro vezes é informação diferente de quatro máquinas adiadas uma
  // vez, e o motivo que mais se repete diz onde está o gargalo.

  readonly slips = signal<ScheduleSlip[]>([]);

  readonly slipCount = computed(() => this.slips().length);

  /** Quantas programações distintas adiaram mais de uma vez. */
  readonly repeatOffenders = computed(() => {
    const byRegister = new Map<string, number>();
    for (const slip of this.slips()) {
      byRegister.set(slip.registerId, (byRegister.get(slip.registerId) ?? 0) + 1);
    }
    return [...byRegister.values()].filter(total => total > 1).length;
  });

  /**
   * Mediana, não média: um adiamento de seis meses puxaria a média sozinho e
   * faria o número descrever um caso em vez do conjunto.
   */
  readonly medianSlipDays = computed(() => {
    const days = this.slips()
      .map(slip => {
        const antes = parseDateOnly(slip.previsaoAnterior);
        const depois = parseDateOnly(slip.previsaoNova);
        // Apagar a previsão não tem "quantos dias" — fica fora da conta.
        return antes && depois
          ? Math.round((depois.getTime() - antes.getTime()) / 86_400_000)
          : null;
      })
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    if (!days.length) return 0;
    const middle = Math.floor(days.length / 2);
    return days.length % 2 ? days[middle] : Math.round((days[middle - 1] + days[middle]) / 2);
  });

  /** Quem mais adiou, com o último motivo — que é o que explica. */
  readonly topSlips = computed(() => {
    const byRegister = new Map<string, { label: string; machine: string; count: number; motivo: string }>();

    // A lista vem mais recente primeiro, então o primeiro motivo visto é o último.
    for (const slip of this.slips()) {
      const entry = byRegister.get(slip.registerId);
      if (entry) entry.count += 1;
      else byRegister.set(slip.registerId, {
        label: slip.nomeCliente?.trim() || 'Sem cliente',
        machine: slip.machineName,
        count: 1,
        motivo: slip.motivo,
      });
    }

    return [...byRegister.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  });

  private loadSlips(): void {
    // Desde o primeiro dia do mês aberto — acompanha a navegação do calendário
    // seria confuso, então é sempre o mês corrente.
    const month = startOfMonth(new Date());
    const from = `${month.getFullYear()}-${`${month.getMonth() + 1}`.padStart(2, '0')}-01`;

    this.registerService.slipsSince(from).subscribe({
      next: (list) => this.slips.set(list ?? []),
      error: () => this.slips.set([]),
    });
  }

  // ─── Carga por consultor ──────────────────────────────────────────────────
  //
  // `consultor` já vem na programação e o hub não usava. Responde a pergunta
  // que aparece toda semana — "quem está com a máquina do cliente X?" — sem
  // nenhuma chamada nova: a lista inteira já está no store.

  readonly consultantLoad = computed<ConsultantLoad[]>(() => {
    const byConsultant = new Map<string, ConsultantLoad>();

    for (const register of this.registerStore.items()) {
      // Entregue saiu da mão de todo mundo. Carga é o que ainda pesa.
      if (register.status === MachineStatus.ENTREGUE) continue;

      const name = register.consultor?.trim() || 'Sem consultor';
      const entry = byConsultant.get(name)
        ?? { name, open: 0, late: 0 };

      entry.open += 1;
      if (isLate(register)) entry.late += 1;

      byConsultant.set(name, entry);
    }

    return [...byConsultant.values()].sort((a, b) => b.open - a.open);
  });

  readonly totalOpen = computed(() =>
    this.consultantLoad().reduce((total, entry) => total + entry.open, 0));

  /** A barra é relativa a quem tem mais, não ao total — comparar é o ponto. */
  readonly loadWidth = computed(() => {
    const most = this.consultantLoad()[0]?.open ?? 0;
    return (open: number) => (most ? Math.round((open / most) * 100) : 0);
  });

  // ─── Calendário de implantações ───────────────────────────────────────────
  //
  // Mesmo desenho do Painel de RH, mas sem ir ao servidor a cada mês: a
  // programação inteira já está no store, então virar o mês é só refiltrar o
  // que está em memória.

  readonly displayedMonth = signal(startOfMonth(new Date()));

  /**
   * As cores da legenda são as mesmas severidades dos chips de status da
   * Programação — quem vê o quadro lá reconhece aqui sem reaprender.
   */
  readonly calendarLegend: CalendarLegendItem[] = [
    { tone: 'success', label: 'Disponível' },
    { tone: 'warning', label: 'Reforma / liberar equipamentos' },
    { tone: 'danger', label: 'Aguardando aquisição' },
    { tone: 'neutral', label: 'Entregue / reservada' },
    { alert: true, label: 'Previsão vencida sem entrega' },
  ];

  /**
   * O que o calendário desenha.
   *
   * Vai a lista inteira, sem recortar pelo mês: o componente indexa por dia e
   * virar o mês passa a ser leitura de um `Map` que já existe, em vez de um
   * recálculo a cada clique.
   */
  readonly calendarEvents = computed<CalendarDayEvent[]>(() =>
    [...this.entriesByDay().values()].flat().map(entry => ({
      date: parseDateOnly(entry.register.previsaoEntrega)!,
      label: entry.label,
      tone: entry.severity as CalendarTone,
      detail: `${entry.machine} · ${entry.statusLabel}`,
      alert: entry.late,
    })));

  /**
   * Previsões indexadas por dia. O template chama `entriesFor` uma vez por
   * célula — 42 buscas por render — e varrer a lista toda em cada uma seria
   * quadrático à toa.
   */
  private readonly entriesByDay = computed(() => {
    const today = startOfToday();
    const byDay = new Map<string, DayEntry[]>();

    for (const register of this.registerStore.items()) {
      const date = parseDateOnly(register.previsaoEntrega);
      if (!date) continue;

      const machine = this.machineStore.nameOf(register.machineId);
      const entry: DayEntry = {
        register,
        machine,
        label: register.nomeCliente?.trim() || machine,
        statusLabel: MACHINE_STATUS_LABEL[register.status] ?? register.status,
        severity: MACHINE_STATUS_SEVERITY[register.status] ?? 'neutral',
        late: date < today && register.status !== MachineStatus.ENTREGUE,
      };

      const key = dayKey(date);
      const list = byDay.get(key);
      if (list) list.push(entry);
      else byDay.set(key, [entry]);
    }

    return byDay;
  });

  /**
   * Quantas implantações caem no mês aberto — o número do cabeçalho.
   *
   * Contava varrendo as 42 células da grade; agora que a grade mora no
   * componente, conta pelas previsões direto. Mesmo número, sem depender do
   * desenho.
   */
  readonly monthCount = computed(() => {
    const month = this.displayedMonth();
    return this.calendarEvents().filter(event =>
      event.date.getMonth() === month.getMonth()
      && event.date.getFullYear() === month.getFullYear()).length;
  });

  readonly dayDialogVisible = signal(false);
  readonly selectedDay = signal<Date | null>(null);

  readonly dayEntries = computed(() => {
    const day = this.selectedDay();
    return day ? this.entriesFor(day) : [];
  });

  entriesFor(day: Date): DayEntry[] {
    return this.entriesByDay().get(dayKey(day)) ?? [];
  }

  openDay(day: Date): void {
    if (this.entriesFor(day).length === 0) return;
    this.selectedDay.set(day);
    this.dayDialogVisible.set(true);
  }

  ngOnInit(): void {
    this.machineStore.load();
    this.registerStore.load();
    this.loadDivergences();
    this.loadSlips();
  }

  refresh(): void {
    this.machineStore.refresh();
    this.registerStore.refresh();
    this.loadDivergences();
    this.loadSlips();
  }

  /** O mesmo rótulo que o calendário usa, agora também na lista de paradas. */
  statusLabel(status: MachineStatus): string {
    return MACHINE_STATUS_LABEL[status] ?? status;
  }

  paradaLabel(item: Parada): string {
    if (item.diasParada === null) return 'Sem data de entrada';
    if (item.diasParada <= 0) return 'Entrou hoje';
    if (item.diasParada === 1) return 'Há 1 dia';
    return `Há ${item.diasParada} dias`;
  }

  dueLabel(item: UpcomingExit): string {
    if (item.daysLeft < 0) return `${Math.abs(item.daysLeft)} dia(s) em atraso`;
    if (item.daysLeft === 0) return 'Hoje';
    if (item.daysLeft === 1) return 'Amanhã';
    return `Em ${item.daysLeft} dias`;
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Uma linha da faixa "Precisa de você". */
interface AttentionItem {
  tone: 'danger' | 'warning' | 'info';
  lead: string;
  detail: string;
  cta: string;
  link: string;
}

/** "1 máquina" e "2 máquinas" — o `(s)` no meio do texto lê mal. */
function plural(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Quantas máquinas em aberto cada consultor carrega, e quantas já atrasaram. */
interface ConsultantLoad {
  name: string;
  open: number;
  late: number;
}

/**
 * Previsão vencida e a máquina não saiu.
 *
 * Mesmo critério do chip do calendário: sem previsão não é atraso, é falta de
 * programação — e essa lista já existe separada.
 */
function isLate(register: MachineRegister): boolean {
  const previsao = parseDateOnly(register.previsaoEntrega);
  return !!previsao
    && previsao < startOfToday()
    && register.status !== MachineStatus.ENTREGUE;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Chave local `2026-08-11`. `toISOString` viraria o dia em fuso negativo. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
