import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';

import { MachineStatus, MACHINE_STATUS_LABEL, MachineType } from '../../../../domain/models/prostock/machine.model';
import { CreateMachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkFileUploadComponent } from '../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { ParseResult, ParsedRow, normalize, parseProgramacaoSheet } from './programacao-import.parser';

type Phase = 'choose' | 'review' | 'running' | 'done';

/**
 * Importação da planilha para a programação.
 *
 * Roda inteira no navegador: lê o `.xlsx`, cria as máquinas que faltam e manda
 * uma linha de cada vez por `POST api/machine/register`. Não depende de
 * endpoint novo — o que importa é tirar os dados do Excel, não fazer isso
 * rápido.
 *
 * Ocupa a tela inteira em modo formulário, como os cadastros: a conferência
 * mostra ~200 linhas e num diálogo isso vira uma tabela espremida. É o mesmo
 * padrão de grade ↔ formulário do resto do sistema.
 */
@Component({
  selector: 'app-programacao-import',
  standalone: true,
  imports: [CommonModule, TableModule, FormScreenComponent, PkButtonComponent, PkFileUploadComponent],
  templateUrl: './programacao-import.component.html',
  styleUrl: './programacao-import.component.scss',
})
export class ProgramacaoImportComponent {

  private readonly machineStore = inject(MachineStore);
  private readonly registerStore = inject(MachineRegisterStore);
  private readonly registerService = inject(RegisterService);
  private readonly machineService = inject(MachineService);

  closed = output<void>();
  finished = output<void>();

  readonly phase = signal<Phase>('choose');
  readonly parsed = signal<ParseResult | null>(null);
  readonly fileName = signal('');
  readonly parseError = signal('');

  /** Progresso do envio, para as ~200 linhas não parecerem travamento. */
  readonly sent = signal(0);
  readonly failed = signal<{ row: ParsedRow; reason: string }[]>([]);

  readonly total = computed(() => this.parsed()?.rows.length ?? 0);
  readonly progress = computed(() => {
    const total = this.total();
    return total ? Math.round((this.sent() / total) * 100) : 0;
  });

  readonly warningCount = computed(() =>
    this.parsed()?.rows.filter(row => row.warnings.length > 0).length ?? 0);

  /** Máquinas citadas na planilha que ainda não existem no cadastro. */
  readonly missingMachines = computed(() => {
    const parsed = this.parsed();
    if (!parsed) return [];

    const known = new Set(this.machineStore.items().map(machine => normalize(machine.name)));
    return parsed.machineNames.filter(name => !known.has(normalize(name)));
  });

  statusLabel(status: MachineStatus): string {
    return MACHINE_STATUS_LABEL[status] ?? status;
  }

  /** Enquanto envia, sair no meio deixaria metade das linhas importadas. */
  get canClose(): boolean {
    return this.phase() !== 'running';
  }

  close(): void {
    if (!this.canClose) return;
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.phase.set('choose');
    this.parsed.set(null);
    this.fileName.set('');
    this.parseError.set('');
    this.sent.set(0);
    this.failed.set([]);
  }

  onFileSelected(files: File[]): void {
    const file = files[0];
    if (!file) return;

    this.fileName.set(file.name);
    this.parseError.set('');

    file.arrayBuffer()
      .then(buffer => {
        const result = parseProgramacaoSheet(buffer);
        if (result.rows.length === 0) {
          this.parseError.set('Não encontrei linhas com máquina ou cliente nesta planilha.');
          return;
        }
        this.parsed.set(result);
        this.phase.set('review');
      })
      .catch(() => this.parseError.set('Não consegui ler o arquivo. Ele é um .xlsx válido?'));
  }

  /**
   * Cria as máquinas que faltam e só então manda as linhas: sem elas, o
   * registro não tem `machineId` e a API recusa.
   */
  start(): void {
    const parsed = this.parsed();
    if (!parsed) return;

    this.phase.set('running');
    this.sent.set(0);
    this.failed.set([]);

    this.createMissingMachines()
      .then(() => this.machineStore.refresh())
      .then(() => this.sendRows(parsed.rows))
      .then(() => {
        this.registerStore.refresh();
        this.phase.set('done');
        this.finished.emit();
      })
      .catch(() => this.phase.set('done'));
  }

  private async createMissingMachines(): Promise<void> {
    const missing = this.missingMachines();

    for (const name of missing) {
      await new Promise<void>(resolve => {
        this.machineService.create({
          systemCode: name.slice(0, 20),
          name,
          brand: '',
          machineType: guessType(name),
          machineStatus: MachineStatus.DISPONIVEL,
          minimum_stock: 0,
          active: true,
        }).subscribe({ next: () => resolve(), error: () => resolve() });
      });
    }
  }

  /**
   * Uma linha por vez, de propósito: em paralelo, duzentas requisições podem
   * derrubar a API, e um erro no meio vira uma lista de falhas sem ordem.
   */
  private async sendRows(rows: ParsedRow[]): Promise<void> {
    const byName = new Map(this.machineStore.items().map(m => [normalize(m.name), m.id]));

    for (const row of rows) {
      const machineId = byName.get(normalize(row.maquinaNome));

      if (!machineId) {
        this.failed.update(list => [...list, { row, reason: 'Máquina não encontrada no cadastro.' }]);
        this.sent.update(value => value + 1);
        continue;
      }

      const payload: CreateMachineRegister = {
        machineId,
        nomeCliente: row.nomeCliente,
        tag: 0,
        regiao: row.regiao,
        solicitante: row.solicitante,
        status: row.status,
        Observacao: row.observacao,
        previsaoEntrega: toLocalDateTime(row.previsao),
        consultor: row.consultor,
        tecnico: row.tecnico,
      };

      await new Promise<void>(resolve => {
        this.registerService.create(payload).subscribe({
          next: () => { this.sent.update(v => v + 1); resolve(); },
          error: (err: HttpErrorResponse) => {
            this.failed.update(list => [...list, { row, reason: reasonFor(err) }]);
            this.sent.update(v => v + 1);
            resolve();
          },
        });
      });
    }
  }
}

/** Chuta o tipo pelo nome, que é o que a planilha dá. O usuário corrige depois. */
function guessType(name: string): MachineType {
  const value = normalize(name);
  if (value.includes('FRONTAL')) return MachineType.FRONTAL;
  if (value.includes('ESTEIRA')) return MachineType.ESTEIRA;
  return MachineType.CAPO;
}

function toLocalDateTime(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00:00`;
}

function reasonFor(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Sem conexão com o servidor.';
  if (typeof err.error === 'string' && err.error) return err.error;
  return `Erro ${err.status}.`;
}
