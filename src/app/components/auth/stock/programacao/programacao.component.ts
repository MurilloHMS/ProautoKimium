import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_SEVERITY,
  MachineStatus,
  machineStatusOptions,
} from '../../../../domain/models/prostock/machine.model';
import { CreateMachineRegister, MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { parseDateOnly } from '../../../../domain/utils/date-only';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';

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
 * Faltam REGIÃO e CONSULTOR — existem na planilha e ainda não na API. Enquanto
 * não existirem, esta tela não aposenta o Excel.
 */
@Component({
  selector: 'app-programacao',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, SelectModule, DatePickerModule, InputTextModule,
    ButtonModule, Toast, Tooltip, ToolbarComponent, PkButtonComponent,
  ],
  templateUrl: './programacao.component.html',
  styleUrl: './programacao.component.scss',
  providers: [MessageService],
})
export class ProgramacaoComponent implements OnInit {

  private readonly store = inject(MachineRegisterStore);
  private readonly machineStore = inject(MachineStore);
  private readonly registerService = inject(RegisterService);
  private readonly messageService = inject(MessageService);

  readonly loading = this.store.loading;
  readonly statusOptions = machineStatusOptions();
  readonly machineOptions = this.machineStore.activeOptions;

  search = '';
  private readonly searchTrigger = signal(0);

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

    const saved = this.store.items().map(register => this.toRow(register));
    const filtered = !term ? saved : saved.filter(row =>
      row.nomeCliente?.toLowerCase().includes(term)
      || row.tecnico?.toLowerCase().includes(term)
      || row.solicitante?.toLowerCase().includes(term)
      || this.machineName(row.machineId).toLowerCase().includes(term));

    return [...this.drafts(), ...filtered];
  });

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
      solicitante: '',
      status: MachineStatus.PRONTA,
      Observacao: '',
      previsaoEntrega: null,
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
      solicitante: row.solicitante ?? '',
      status: row.status,
      Observacao: row.Observacao ?? '',
      previsaoEntrega: this.toLocalDateTime(row.previsao),
      tecnico: row.tecnico ?? '',
    };

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
    if (this.isDraft(row) || this.isSaving(row.id)) return;

    this.mark('saving', row.id, true);
    this.mark('saved', row.id, false);

    const payload = {
      nomeCliente: row.nomeCliente ?? '',
      tag: Number(row.tag) || 0,
      solicitante: row.solicitante ?? '',
      status: row.status,
      Observacao: row.Observacao ?? '',
      previsaoEntrega: this.toLocalDateTime(row.previsao),
      tecnico: row.tecnico ?? '',
    };

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

  deleteRow(row: Row): void {
    if (this.isDraft(row)) {
      this.discardDraft(row);
      return;
    }

    this.store.deleteById(row.id).subscribe({
      next: () => this.messageService.add({ severity: 'success', summary: 'Linha removida', detail: row.nomeCliente }),
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
