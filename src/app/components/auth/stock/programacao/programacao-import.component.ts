import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';

import { MachineStatus, MACHINE_STATUS_LABEL } from '../../../../domain/models/prostock/machine.model';
import { CreateMachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkFileUploadComponent } from '../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';
import { ParseResult, ParsedRow, normalize, parseProgramacaoSheet } from './programacao-import.parser';

type Phase = 'choose' | 'review' | 'running' | 'done';

/**
 * Importação da planilha para a programação.
 *
 * Roda inteira no navegador: lê o `.xlsx` e manda uma linha de cada vez por
 * `POST api/machine/register`. Não depende de endpoint novo — o que importa é
 * tirar os dados do Excel, não fazer isso rápido.
 *
 * **Não cadastra máquina.** Antes cadastrava, com um código inventado a partir
 * do nome, e era assim que o mesmo equipamento acabava duas vezes no catálogo.
 * Máquina é produto: quem não existe é listado para ser cadastrado em Estoque ›
 * Produtos, com o código real, antes de importar.
 *
 * **Reimportar é seguro.** Linha já importada é pulada — a chave é máquina +
 * cliente + previsão de saída, que é o que identifica uma implantação. Subir a
 * mesma planilha cinco vezes importa só o que entrou nela desde a última vez.
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

  closed = output<void>();
  finished = output<void>();

  readonly phase = signal<Phase>('choose');
  readonly parsed = signal<ParseResult | null>(null);
  readonly fileName = signal('');
  readonly parseError = signal('');

  /** Progresso do envio, para as ~200 linhas não parecerem travamento. */
  readonly sent = signal(0);
  readonly failed = signal<{ row: ParsedRow; reason: string }[]>([]);

  /** Linhas que já estavam programadas — reimportação não duplica. */
  readonly skipped = signal(0);

  readonly total = computed(() => this.parsed()?.rows.length ?? 0);
  readonly progress = computed(() => {
    const total = this.total();
    return total ? Math.round((this.sent() / total) * 100) : 0;
  });

  readonly warningCount = computed(() =>
    this.parsed()?.rows.filter(row => row.warnings.length > 0).length ?? 0);

  /**
   * Máquinas citadas na planilha que não existem no cadastro de produtos.
   *
   * Deixou de ser aviso e virou impedimento: um código de sistema é dado do
   * ERP, a planilha não tem esse dado, e inventar um gera produto que ninguém
   * consegue reconciliar depois.
   */
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
    this.skipped.set(0);
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

  /** Só importa com todas as máquinas cadastradas: sem `machineId` a API recusa. */
  get canStart(): boolean {
    return this.missingMachines().length === 0;
  }

  start(): void {
    const parsed = this.parsed();
    if (!parsed || !this.canStart) return;

    this.phase.set('running');
    this.sent.set(0);
    this.skipped.set(0);
    this.failed.set([]);

    this.sendRows(parsed.rows)
      .then(() => {
        this.registerStore.refresh();
        this.phase.set('done');
        this.finished.emit();
      })
      .catch(() => this.phase.set('done'));
  }

  /**
   * Uma linha por vez, de propósito: em paralelo, duzentas requisições podem
   * derrubar a API, e um erro no meio vira uma lista de falhas sem ordem.
   */
  private async sendRows(rows: ParsedRow[]): Promise<void> {
    const byName = new Map(this.machineStore.items().map(m => [normalize(m.name), m.id]));

    // O que já está programado. Reimportar a mesma planilha não pode criar a
    // implantação de novo — e antes criava, uma cópia por upload.
    const existing = new Set(this.registerStore.items().map(register =>
      registerKey(register.machineId, register.nomeCliente, register.previsaoEntrega)));

    for (const row of rows) {
      const machineId = byName.get(normalize(row.maquinaNome));

      if (!machineId) {
        this.failed.update(list => [...list, { row, reason: 'Máquina não encontrada no cadastro.' }]);
        this.sent.update(value => value + 1);
        continue;
      }

      const previsao = toLocalDateTime(row.previsao);

      if (existing.has(registerKey(machineId, row.nomeCliente, previsao))) {
        this.skipped.update(value => value + 1);
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
        previsaoEntrega: previsao,
        consultor: row.consultor,
        tecnico: row.tecnico,

        // Explícito, e nunca `true`: a planilha traz o histórico da programação,
        // não máquinas chegando agora. Ligar isto faria uma importação de 200
        // linhas lançar 200 entradas e estourar o estoque de todas as máquinas
        // de uma vez.
        adjustStock: false,
      };

      await new Promise<void>(resolve => {
        this.registerService.create(payload).subscribe({
          next: () => {
            // A planilha também repete linha entre abas e revisões: sem isto,
            // duas linhas iguais no mesmo arquivo virariam dois registros.
            existing.add(registerKey(machineId, row.nomeCliente, previsao));
            this.sent.update(v => v + 1);
            resolve();
          },
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

/**
 * Identidade de uma implantação: máquina, cliente e data de saída.
 *
 * Não usa a linha da planilha nem a observação de propósito — os dois mudam
 * entre revisões do mesmo arquivo, e a implantação continua sendo a mesma.
 */
function registerKey(machineId: string, nomeCliente: string, previsao: string | null): string {
  return [machineId, normalize(nomeCliente), previsao ?? ''].join('|');
}
