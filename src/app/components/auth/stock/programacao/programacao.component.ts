import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkMultiselectComponent } from '../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

import {
  MACHINE_STATUS_LABEL,
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
  UpdateMachineRegister,
} from '../../../../domain/models/prostock/register.model';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { formatStampBr, parseDateOnly } from '../../../../domain/utils/date-only';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { ProgramacaoImportComponent } from './programacao-import.component';

/**
 * Linha da grade: o registro da API mais a data já convertida para o datepicker.
 *
 * O estado de "salvando/salvo" NÃO mora aqui. As linhas são recriadas toda vez
 * que o `computed` roda, então uma flag no objeto se perderia no primeiro
 * recálculo — fica em signals por id.
 */
interface Row extends MachineRegister {
  previsao: Date | null;
}

/**
 * Programação de máquinas — a planilha.
 *
 * Grade editável de propósito: o time trabalha nisso o dia inteiro no Excel, e
 * abrir um formulário por linha seria mais lento do que a ferramenta que estamos
 * substituindo. Edita na célula, sai com Tab, salva a linha.
 *
 * As colunas são as nove da planilha. Os filtros da toolbar existem porque o
 * quadro passa de duzentas linhas: status, máquina e atraso são os recortes que
 * o time faz com o olho hoje.
 */
@Component({
  selector: 'app-programacao',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, DatePickerModule, InputTextModule,
    ButtonModule, Toast, Tooltip, ToolbarComponent, PkButtonComponent,
    PkComboboxComponent, PkMultiselectComponent, ProgramacaoImportComponent,
    PkDialogComponent, TextareaModule, ConfirmDialogModule,
  ],
  templateUrl: './programacao.component.html',
  styleUrl: './programacao.component.scss',
  providers: [MessageService, ConfirmationService],
})
export class ProgramacaoComponent implements OnInit {

  private readonly store = inject(MachineRegisterStore);
  private readonly machineStore = inject(MachineStore);
  private readonly registerService = inject(RegisterService);
  private readonly inventoryService = inject(InventoryProductService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly loading = this.store.loading;
  readonly statusOptions = machineStatusOptions();
  readonly machineOptions = this.machineStore.activeOptions;

  search = '';
  private readonly searchTrigger = signal(0);

  // ─── Filtros da toolbar ───────────────────────────────────────────────────
  // Visão rápida: o quadro tem ~200 linhas e ninguém lê tudo. Os três recortes
  // que o time usa são status, máquina e "o que está atrasado".
  readonly statusFilter = signal<MachineStatus[]>([]);
  readonly machineFilter = signal<string | null>(null);
  readonly onlyLate = signal(false);

  // ─── Motivo do adiamento ─────────────────────────────────────────────────
  //
  // A API recusa com 400 quando a previsão muda e já havia data. Em vez de
  // deixar o erro chegar e a linha voltar atrás, a tela pergunta antes — o
  // motivo é informação que só a pessoa tem, e pedir depois de falhar seria
  // castigo por algo que ela não podia adivinhar.

  readonly motivoAberto = signal(false);
  readonly motivoTexto = signal('');

  /** O que fica esperando o motivo para poder ser gravado. */
  private pendente: { row: Row; payload: UpdateMachineRegister } | null = null;

  readonly motivoValido = computed(() => this.motivoTexto().trim().length > 0);

  // ─── Confirmação de estoque ──────────────────────────────────────────────
  //
  // Uma linha de programação é uma máquina física. Sair do estoque para
  // ENTREGUE tira uma do galpão; voltar devolve. A tela mostra o número antes
  // de gravar, porque "mudei um status" e "mexi no estoque" não parecem a
  // mesma ação para quem está editando a grade.

  readonly stockDialogOpen = signal(false);
  readonly loadingStock = signal(false);
  readonly currentStock = signal(0);
  readonly stockDelta = signal(0);
  readonly stockMachineName = signal('');

  /** O que fica esperando a confirmação do estoque. */
  private pendingStock:
    | { row: Row; payload: UpdateMachineRegister }
    | { draft: Row; payload: CreateMachineRegister }
    | null = null;

  readonly newStock = computed(() => this.currentStock() + this.stockDelta());

  /**
   * O estoque em movimentações não bate com a programação.
   *
   * Acontece de verdade: são duas contagens do mesmo fato, e qualquer caminho
   * antigo pode tê-las separado. Travar aqui deixaria a pessoa sem saída, então
   * o botão muda de função em vez de sumir.
   */
  readonly stockWouldGoNegative = computed(() => this.newStock() < 0);

  // ─── Histórico de adiamentos ─────────────────────────────────────────────
  //
  // Carregado sob demanda, um GET por vez que alguém abre. A alternativa seria
  // trazer a contagem junto da grade, e aí seria um GET por linha numa tela que
  // costuma ter centenas — caro para uma informação que se consulta raramente.

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

  readonly hasFilters = computed(() =>
    this.statusFilter().length > 0 || !!this.machineFilter() || this.onlyLate());

  /**
   * Grade ou importação. A importação ocupa a tela inteira, como os cadastros:
   * a conferência mostra ~200 linhas e num diálogo isso fica espremido.
   */
  readonly mode = signal<'grid' | 'import'>('grid');

  clearFilters(): void {
    this.statusFilter.set([]);
    this.machineFilter.set(null);
    this.onlyLate.set(false);
    this.search = '';
    this.onSearch();
  }

  /** Atrasado: previsão vencida e ainda não entregue. */
  isLate(row: Row): boolean {
    if (!row.previsao || row.status === MachineStatus.ENTREGUE) return false;
    return row.previsao < startOfToday();
  }

  /** Linhas ainda não salvas, no topo — some quando a API confirma. */
  readonly drafts = signal<Row[]>([]);

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

  readonly rows = computed<Row[]>(() => {
    this.searchTrigger();
    const term = this.search.toLowerCase().trim();
    const statuses = this.statusFilter();
    const machine = this.machineFilter();
    const late = this.onlyLate();

    const filtered = this.store.items()
      .map(register => this.toRow(register))
      .filter(row => {
        if (statuses.length && !statuses.includes(row.status)) return false;
        if (machine && row.machineId !== machine) return false;
        if (late && !this.isLate(row)) return false;

        if (!term) return true;
        return row.nomeCliente?.toLowerCase().includes(term)
          || row.tecnico?.toLowerCase().includes(term)
          || row.consultor?.toLowerCase().includes(term)
          || row.regiao?.toLowerCase().includes(term)
          || row.solicitante?.toLowerCase().includes(term)
          || this.machineName(row.machineId).toLowerCase().includes(term);
      });

    // Rascunho sempre no topo, sem passar pelo filtro: some da tela ao filtrar
    // seria confuso logo depois de clicar em "Nova linha".
    return [...this.drafts(), ...filtered];
  });

  readonly lateCount = computed(() =>
    this.store.items().map(r => this.toRow(r)).filter(row => this.isLate(row)).length);

  ngOnInit(): void {
    this.store.load();
    this.machineStore.load();
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
   * A linha nasce local. Só vai para a API quando tiver máquina e cliente —
   * assim ninguém cria registro vazio por engano, que é o que aconteceria se
   * gravássemos no clique.
   */
  addRow(): void {
    const draft: Row = {
      id: `draft-${Date.now()}`,
      machineId: this.machineOptions()[0]?.value ?? '',
      nomeCliente: '',
      tag: 0,
      regiao: '',
      solicitante: '',
      status: MachineStatus.DISPONIVEL,
      Observacao: '',
      previsaoEntrega: null,
      consultor: '',
      tecnico: '',
      previsao: null,
    };
    this.drafts.update(list => [draft, ...list]);
  }

  discardDraft(row: Row): void {
    this.drafts.update(list => list.filter(item => item.id !== row.id));
  }

  canSaveDraft(row: Row): boolean {
    return !!row.machineId && row.nomeCliente.trim().length > 0;
  }

  saveDraft(row: Row): void {
    if (!this.canSaveDraft(row) || this.isSaving(row.id)) return;

    this.mark('saving', row.id, true);
    const payload: CreateMachineRegister = {
      machineId: row.machineId,
      nomeCliente: row.nomeCliente.trim(),
      tag: Number(row.tag) || 0,
      regiao: row.regiao ?? '',
      solicitante: row.solicitante ?? '',
      status: row.status,
      Observacao: row.Observacao ?? '',
      previsaoEntrega: this.toLocalDateTime(row.previsao),
      consultor: row.consultor ?? '',
      tecnico: row.tecnico ?? '',
    };

    // Linha nova nascendo em estoque é uma máquina entrando no galpão.
    const delta = stockDeltaFor(null, row.status);
    if (delta !== 0) {
      this.pendingStock = { draft: row, payload };
      this.mark('saving', row.id, false);
      this.openStockDialog(row.machineId, delta);
      return;
    }

    this.createRow(row, payload);
  }

  private createRow(row: Row, payload: CreateMachineRegister): void {
    this.mark('saving', row.id, true);

    this.store.create(payload).subscribe({
      next: () => {
        this.mark('saving', row.id, false);
        this.discardDraft(row);
        this.messageService.add({ severity: 'success', summary: 'Linha incluída', detail: payload.nomeCliente });
      },
      error: (err: HttpErrorResponse) => {
        this.mark('saving', row.id, false);
        this.showError(err);
      },
    });
  }

  // ─── A checagem do estoque ───────────────────────────────────────────────

  /**
   * Pergunta antes de gravar, mas **só quando a transição cruza a fronteira**.
   *
   * DISPONIVEL → RESERVADA não pergunta nada: a máquina continua no galpão, e
   * um diálogo aí seria atrito puro numa grade que se edita o dia todo.
   */
  private checkStockBeforeUpdate(row: Row, payload: UpdateMachineRegister): void {
    const stored = this.store.items().find(item => item.id === row.id);
    const delta = stored ? stockDeltaFor(stored.status, payload.status) : 0;

    if (delta === 0) {
      this.gravar(row, payload);
      return;
    }

    this.pendingStock = { row, payload };
    this.openStockDialog(row.machineId, delta);
  }

  /**
   * O estoque atual vem do último movimento, como na tela de movimentação.
   *
   * Carregado no clique e não junto da grade: seria um GET por linha numa tela
   * de centenas, para um número que só interessa nesse instante.
   */
  private openStockDialog(machineId: string, delta: number): void {
    const machine = this.machineStore.items().find(item => item.id === machineId);

    this.stockDelta.set(delta);
    this.stockMachineName.set(machine?.name ?? 'esta máquina');
    this.currentStock.set(0);
    this.loadingStock.set(true);
    this.stockDialogOpen.set(true);

    if (!machine) {
      this.loadingStock.set(false);
      return;
    }

    this.inventoryService.getInventoryMovementsByProduct(machine.systemCode).subscribe({
      next: (list) => {
        const sorted = [...(list ?? [])].sort((a, b) => a.movementDate.localeCompare(b.movementDate));
        this.currentStock.set(sorted.length ? sorted[sorted.length - 1].quantity : 0);
        this.loadingStock.set(false);
      },
      // 404 é máquina sem movimento nenhum: estoque zero, não erro.
      error: () => this.loadingStock.set(false),
    });
  }

  /**
   * Confirma e grava, com o `adjustStock` ligado.
   *
   * Quando o estoque ficaria negativo o botão vira "salvar sem mexer no
   * estoque" e manda `false`: a divergência já existia antes desta edição, e
   * travar a pessoa aqui não conserta nada — só impede o trabalho dela.
   */
  confirmStockChange(): void {
    if (!this.pendingStock || this.loadingStock()) return;

    const adjustStock = !this.stockWouldGoNegative();
    const pending = this.pendingStock;
    this.pendingStock = null;
    this.stockDialogOpen.set(false);

    if ('draft' in pending) {
      this.createRow(pending.draft, { ...pending.payload, adjustStock });
    } else {
      this.gravar(pending.row, { ...pending.payload, adjustStock });
    }
  }

  /**
   * Desistir desfaz a edição.
   *
   * Mesmo motivo do `cancelarMotivo`: deixar o status novo na tela sem gravar é
   * pior que o erro, porque a pessoa sai achando que salvou.
   */
  cancelStockChange(): void {
    const pending = this.pendingStock;
    this.pendingStock = null;
    this.stockDialogOpen.set(false);

    if (pending && !('draft' in pending)) this.store.refresh();
  }

  // ─── Edição em célula ─────────────────────────────────────────────────────

  /**
   * Chamado ao sair da célula. Salva a linha inteira porque a API só tem PUT de
   * registro completo — não há PATCH de campo.
   *
   * Grava pelo service e atualiza a lista com `upsert`, em vez de recarregar
   * tudo: um `refresh` a cada célula recriaria as linhas e apagaria o que o
   * usuário estivesse digitando em outra célula.
   */
  onCellEdited(row: Row): void {
    if (!row || this.isDraft(row) || this.isSaving(row.id)) return;

    const payload: UpdateMachineRegister = {
      nomeCliente: row.nomeCliente ?? '',
      tag: Number(row.tag) || 0,
      regiao: row.regiao ?? '',
      solicitante: row.solicitante ?? '',
      status: row.status,
      Observacao: row.Observacao ?? '',
      previsaoEntrega: this.toLocalDateTime(row.previsao),
      consultor: row.consultor ?? '',
      tecnico: row.tecnico ?? '',
    };

    // O combo já salva na seleção e o `onEditComplete` chega logo depois; sem
    // isto, todo Tab por uma célula intocada viraria um PUT.
    const stored = this.store.items().find(item => item.id === row.id);
    if (stored && !hasChanges(stored, payload)) return;

    // Adiar exige motivo; preencher pela primeira vez, não. A regra é a mesma
    // da API, e está repetida aqui só para perguntar antes de falhar — quem
    // decide continua sendo o servidor.
    if (stored && adiouPrevisao(stored, payload)) {
      this.pendente = { row, payload };
      this.motivoTexto.set('');
      this.motivoAberto.set(true);
      return;
    }

    this.checkStockBeforeUpdate(row, payload);
  }

  /** Confirma o motivo e solta o PUT que estava esperando. */
  confirmarMotivo(): void {
    if (!this.motivoValido() || !this.pendente) return;

    const { row, payload } = this.pendente;
    this.pendente = null;
    this.motivoAberto.set(false);

    // Os dois diálogos podem cair na mesma edição — mudar a data E o status de
    // uma vez. Em fila, nunca ao mesmo tempo: um por cima do outro esconderia
    // metade da pergunta.
    this.checkStockBeforeUpdate(row, { ...payload, motivoAlteracaoPrevisao: this.motivoTexto().trim() });
  }

  /**
   * Desistir do motivo desfaz a edição.
   *
   * Deixar a data nova na tela sem gravar seria pior que o erro: a pessoa sai
   * achando que salvou. O `refresh` traz de volta o que está no banco.
   */
  cancelarMotivo(): void {
    this.pendente = null;
    this.motivoAberto.set(false);
    this.store.refresh();
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

  /**
   * Esc cancela a edição. O PrimeNG só desfaz a célula quando o `data` do
   * `pEditableColumn` é o próprio valor; aqui passamos a linha inteira, então
   * o desfazer é nosso — senão a tela mostraria um valor que não foi gravado.
   */
  onCellCancelled(row: Row): void {
    if (!row || this.isDraft(row)) return;

    const stored = this.store.items().find(item => item.id === row.id);
    if (!stored) return;

    Object.assign(row, stored, { previsao: parseDateOnly(stored.previsaoEntrega) });
  }

  /**
   * Excluir pede confirmação; descartar rascunho, não.
   *
   * Rascunho é uma linha que nunca existiu no banco — perguntar ali é atrito
   * por nada. Já a exclusão de verdade leva junto **o histórico de adiamentos**
   * (`ON DELETE CASCADE` na V82), e é isso que a pergunta precisa dizer: o que
   * some não é só a linha.
   */
  deleteRow(row: Row): void {
    if (this.isDraft(row)) {
      this.discardDraft(row);
      return;
    }

    const quem = row.nomeCliente?.trim() || 'sem cliente';

    // Apagar não baixa o estoque de propósito: apagar é "essa linha nunca
    // deveria ter existido". Se a máquina está no galpão, o certo é mudar o
    // status. Mas quem clica precisa saber disso antes, não depois.
    const contaNoEstoque = IN_STOCK_STATUSES.includes(row.status)
      ? '<br><br>Esta máquina conta no estoque. Apagar a linha <strong>não</strong> '
        + 'baixa o estoque — para isso, mude o status para Entregue.'
      : '';

    this.confirmationService.confirm({
      header: 'Excluir programação',
      message: `Excluir a programação de <strong>${quem}</strong>? `
        + 'O histórico de adiamentos dessa linha vai junto, e não há como recuperar.'
        + contaNoEstoque,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.confirmarExclusao(row),
    });
  }

  private confirmarExclusao(row: Row): void {
    this.store.deleteById(row.id).subscribe({
      next: () => this.messageService.add({
        severity: 'success',
        summary: 'Linha removida',
        detail: row.nomeCliente,
      }),
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
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    || (Number(stored.tag) || 0) !== payload.tag
    || (stored.regiao ?? '') !== payload.regiao
    || (stored.solicitante ?? '') !== payload.solicitante
    || stored.status !== payload.status
    || (stored.Observacao ?? '') !== payload.Observacao
    || (stored.consultor ?? '') !== payload.consultor
    || (stored.tecnico ?? '') !== payload.tecnico
    || dayPart(stored.previsaoEntrega) !== dayPart(payload.previsaoEntrega);
}

/**
 * Mudou a previsão de um registro que **já tinha** data.
 *
 * Preencher pela primeira vez não entra: é completar cadastro, não adiar.
 * Apagar entra — e é o caso mais grave, porque a máquina some das próximas
 * saídas sem ninguém perceber.
 */
function adiouPrevisao(stored: MachineRegister, payload: UpdateMachineRegister): boolean {
  if (!stored.previsaoEntrega) return false;
  return dayPart(stored.previsaoEntrega) !== dayPart(payload.previsaoEntrega);
}

function dayPart(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}