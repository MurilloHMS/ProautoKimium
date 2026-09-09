import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { FileUploadModule } from 'primeng/fileupload';

import { PkEmptyComponent } from '../../../theme/ProautoKimium/pk-empty/pk-empty.component';
import { NewsletterService } from '../../../../infrastructure/services/newsletter/newsletter.service';
import { formatarDecimal } from '../../../../domain/utils/decimal-br';
import type { Newsletter } from '../../../../domain/models/newsletter.model';
import {
  STATUS_DA_FILA,
  descreverStatus,
  pendentesDe,
  type ResumoDoMes,
  type StatusDaFila,
} from '../../../../domain/models/newsletter/resumo-do-mes.model';

/**
 * O envio da newsletter, um mês por vez.
 *
 * **A newsletter é mensal, e é assim que se fala dela** — "a de junho já saiu?".
 * Antes esta tela era uma lista de 913 linhas com doze colunas: a pergunta só se
 * respondia lendo linha por linha, e o mês nem aparecia como unidade.
 *
 * Agora cada mês é um cartão com a barra do que saiu e do que falta, e a lista
 * abre dentro do mês escolhido — que é a unidade da decisão de quem envia.
 */
@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, FileUploadModule, PkEmptyComponent],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
  providers: [MessageService],
})
export class NewsletterComponent {

  private readonly service = inject(NewsletterService);
  private readonly toast = inject(MessageService);

  readonly meses = signal<ResumoDoMes[]>([]);
  readonly carregando = signal(false);
  readonly enviando = signal(false);

  /** O mês aberto, ou `null` com todos fechados. */
  readonly mesAberto = signal<string | null>(null);
  readonly linhas = signal<Newsletter[]>([]);
  readonly carregandoLinhas = signal(false);

  /**
   * O upload de planilha, escondido.
   *
   * Ele perdeu a função com a aba de revisão — os dados vêm do Sankhya. Fica
   * atrás de um clique, e não apagado, porque a revisão ainda não fechou um mês
   * inteiro em produção: enquanto isso, o caminho antigo é a saída de
   * emergência.
   */
  readonly planilhaAberta = signal(false);
  readonly comCodigoMatriz = signal(false);
  readonly processando = signal(false);

  readonly statusConhecidos: StatusDaFila[] = STATUS_DA_FILA;

  constructor() {
    this.carregar();
  }

  readonly totalPendentes = computed(() =>
    this.meses().reduce((soma, m) => soma + pendentesDe(m), 0));

  // ── Leitura ───────────────────────────────────────────────────────────────

  carregar(): void {
    this.carregando.set(true);

    this.service.resumoPorMes().subscribe({
      next: meses => {
        this.meses.set(meses);
        this.carregando.set(false);
      },
      error: erro => {
        this.carregando.set(false);
        this.avisar(erro, 'Não foi possível carregar a fila.');
      },
    });
  }

  chave(mes: ResumoDoMes): string {
    return `${mes.ano}-${mes.mes}`;
  }

  /**
   * Abre o mês e busca as linhas.
   *
   * Só o mês aberto carrega: são 913 clientes por mês, e trazer o histórico
   * inteiro para mostrar um mês é o que a tela antiga fazia.
   */
  alternar(mes: ResumoDoMes): void {
    const chave = this.chave(mes);

    if (this.mesAberto() === chave) {
      this.mesAberto.set(null);
      this.linhas.set([]);
      return;
    }

    this.mesAberto.set(chave);
    this.linhas.set([]);
    this.carregandoLinhas.set(true);

    this.service.doMes(mes.mes, mes.ano).subscribe({
      next: linhas => {
        this.linhas.set(linhas);
        this.carregandoLinhas.set(false);
      },
      error: erro => {
        this.carregandoLinhas.set(false);
        this.avisar(erro, 'Não foi possível abrir o mês.');
      },
    });
  }

  // ── A barra e os chips ────────────────────────────────────────────────────

  /**
   * As fatias da barra, na ordem do ciclo de vida — pendente, agendada,
   * reenviando, enviada, erro, cancelada.
   *
   * Ordem fixa e não a que o mapa devolveu: a barra do mês passado tem que
   * poder ser comparada com a deste, e para isso as cores precisam ficar
   * sempre no mesmo lugar.
   */
  fatias(mes: ResumoDoMes): Array<StatusDaFila & { quantidade: number }> {
    return this.statusConhecidos
      .map(s => ({ ...s, quantidade: mes.porStatus?.[s.status] ?? 0 }))
      .filter(s => s.quantidade > 0);
  }

  pendentes(mes: ResumoDoMes): number {
    return pendentesDe(mes);
  }

  descrever = descreverStatus;

  // ── Ações ─────────────────────────────────────────────────────────────────

  /**
   * Dispara os pendentes.
   *
   * O endpoint manda a fila inteira, e não a de um mês: é o que existe hoje.
   * O botão fica no mês com pendentes porque é lá que a informação está — mas
   * o texto diz "toda a fila" para ninguém achar que enviou só junho.
   */
  enviarPendentes(): void {
    if (this.enviando()) return;

    this.enviando.set(true);
    this.service.sendPendingNewsletters().subscribe({
      next: mensagem => {
        this.enviando.set(false);
        this.toast.add({ severity: 'success', summary: 'Disparado', detail: mensagem });
        this.carregar();
      },
      error: erro => {
        this.enviando.set(false);
        this.avisar(erro, 'Não foi possível disparar a fila.');
      },
    });
  }

  aoSubirPlanilha(evento: { files: File[] }): void {
    const arquivo = evento?.files?.[0];
    if (!arquivo) return;

    this.processando.set(true);
    this.service.createNewsletterWithOneFile(arquivo, this.comCodigoMatriz()).subscribe({
      next: mensagem => {
        this.processando.set(false);
        this.toast.add({ severity: 'success', summary: 'Planilha lida', detail: String(mensagem) });
        this.carregar();
      },
      error: erro => {
        this.processando.set(false);
        this.avisar(erro, 'Não foi possível ler a planilha.');
      },
    });
  }

  // ── Formatação ────────────────────────────────────────────────────────────

  dinheiro(valor: number): string {
    return `R$ ${formatarDecimal(valor ?? 0, 2)}`;
  }

  data(valor: string | Date | null): string {
    if (!valor) return '';
    return new Intl.DateTimeFormat('pt-BR').format(new Date(valor));
  }

  private avisar(erro: unknown, padrao: string): void {
    const e = erro as { error?: { message?: string } | string; message?: string };
    const mensagem = typeof e?.error === 'string'
      ? e.error
      : e?.error?.message ?? e?.message ?? padrao;

    this.toast.add({ severity: 'warn', summary: 'Erro', detail: mensagem });
  }
}
