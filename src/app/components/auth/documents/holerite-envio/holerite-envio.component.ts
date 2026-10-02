import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { RouterLink } from '@angular/router';

import {
  HoleritePreviewItem,
  HoleritePreviewStatus,
  HoleriteTipo,
  PREVIEW_STATUS_INFO,
  VincularHoleriteResult,
} from '../../../../domain/models/hr/holerite.model';
import { HoleriteService } from '../../../../infrastructure/services/hr/holerite.service';
import { PayslipTypeStore } from '../../../../infrastructure/state/payslip-type.store';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkEmptyComponent } from '../../../theme/ProautoKimium/pk-empty/pk-empty.component';
import { PkFileUploadComponent } from '../../../theme/ProautoKimium/pk-file-upload/pk-file-upload.component';

type Etapa = 'escolha' | 'conferencia' | 'enviado';

/**
 * Envio de holerites, em três passos: escolher, conferir, enviar.
 *
 * O passo do meio é o que faltava. Antes o RH só descobria quem não estava
 * cadastrado depois de gravar — e reenviar o arquivo corrigido duplicava todo
 * mundo. Hoje a conferência mostra o que vai acontecer com cada página, e o
 * envio é idempotente: quem já recebeu é pulado.
 */
@Component({
  selector: 'app-holerite-envio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogModule,
            PkButtonComponent, PkEmptyComponent, PkFileUploadComponent, PkCanDirective],
  templateUrl: './holerite-envio.component.html',
  styleUrl: './holerite-envio.component.scss',
  providers: [ConfirmationService],
})
export class HoleriteEnvioComponent {

  private readonly service = inject(HoleriteService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly types = inject(PayslipTypeStore);

  readonly etapa = signal<Etapa>('escolha');
  readonly conferindo = signal(false);
  readonly enviando = signal(false);
  readonly itens = signal<HoleritePreviewItem[]>([]);
  readonly resultado = signal<VincularHoleriteResult | null>(null);

  // Signals, e não campos comuns: `computed` só reage a signals. Com campo
  // comum, `podeConferir` calculava uma vez, guardava `false` e nunca mais
  // recalculava — escolher arquivo e mês não desbloqueava nada.
  readonly arquivo = signal<File | null>(null);
  readonly competencia = signal('');
  readonly tipo = signal<HoleriteTipo>('SALARIO');

  readonly statusInfo = PREVIEW_STATUS_INFO;
  /** Os tipos vêm do cadastro: o RH cria "PLR" aqui mesmo, e ele fica salvo. */
  readonly tipos = this.types.views;

  // ── Tipo novo, criado no meio do envio ────────────────────────────────────
  readonly criandoTipo = signal(false);
  readonly nomeNovoTipo = signal('');
  readonly salvandoTipo = signal(false);
  readonly avisoTipo = signal('');

  constructor() {
    this.types.load();
  }

  abrirNovoTipo(): void {
    this.nomeNovoTipo.set('');
    this.avisoTipo.set('');
    this.criandoTipo.set(true);
  }

  cancelarNovoTipo(): void {
    this.criandoTipo.set(false);
  }

  /**
   * Cria e já seleciona. Nome que já existia (sem contar caixa nem acento)
   * volta o existente, que é selecionado com um aviso — em vez de "PLR" e
   * "plr" lado a lado.
   */
  criarTipo(): void {
    const nome = this.nomeNovoTipo().trim();
    if (!nome || this.salvandoTipo()) return;
    this.salvandoTipo.set(true);
    this.types.create(nome).subscribe({
      next: r => {
        this.salvandoTipo.set(false);
        this.criandoTipo.set(false);
        this.tipo.set(r.type.code);
        this.voltarParaEscolha();
        this.avisoTipo.set(r.created ? '' : `Já existia o tipo "${r.type.label}". Ele foi selecionado.`);
      },
      error: async err => {
        this.salvandoTipo.set(false);
        this.avisoTipo.set(await apiMessageOrFallback(err, 'Não foi possível criar o tipo.'));
      },
    });
  }

  /** Quantas páginas em cada situação — alimenta o resumo e o texto da confirmação. */
  readonly contagem = computed(() => {
    const mapa = {} as Record<HoleritePreviewStatus, number>;
    for (const item of this.itens()) {
      mapa[item.status] = (mapa[item.status] ?? 0) + 1;
    }
    return mapa;
  });

  readonly totalEnviar = computed(() =>
    (this.contagem().PRONTO ?? 0) + (this.contagem().SEM_USUARIO ?? 0));

  /** Situações presentes, na ordem em que interessam a quem confere. */
  readonly resumo = computed(() => {
    const ordem: HoleritePreviewStatus[] = [
      'PRONTO', 'SEM_USUARIO', 'JA_ENVIADO', 'NAO_CADASTRADO', 'CPF_DUPLICADO', 'CPF_ILEGIVEL',
    ];
    return ordem
      .filter(status => (this.contagem()[status] ?? 0) > 0)
      .map(status => ({ status, quantidade: this.contagem()[status], ...PREVIEW_STATUS_INFO[status] }));
  });

  /**
   * Página ilegível trava o envio.
   *
   * O CPF é lido por regex do texto do PDF. Quando ele falha, a página vira
   * "não encontrada" — mas se aquela pessoa tinha outras páginas, ela recebe um
   * documento incompleto que passa em tudo e parece sucesso. Melhor recusar.
   */
  readonly temIlegivel = computed(() => (this.contagem().CPF_ILEGIVEL ?? 0) > 0);

  readonly podeConferir = computed(() => !!this.arquivo() && !!this.competencia());

  onArquivo(files: File[]): void {
    this.arquivo.set(files[0] ?? null);
    this.voltarParaEscolha();
  }

  /** Trocar arquivo, mês ou tipo invalida a conferência: ela era sobre outra coisa. */
  voltarParaEscolha(): void {
    this.etapa.set('escolha');
    this.itens.set([]);
    this.resultado.set(null);
  }

  conferir(): void {
    if (!this.podeConferir() || this.conferindo()) return;

    this.conferindo.set(true);

    this.service.preview(this.arquivo()!, this.competencia(), this.tipo()).subscribe({
      next: (itens) => {
        this.conferindo.set(false);
        this.itens.set(itens ?? []);
        this.etapa.set('conferencia');
      },
      error: (err: HttpErrorResponse) => {
        this.conferindo.set(false);
        this.erro(err, 'Não foi possível ler o arquivo.');
      },
    });
  }

  confirmarEnvio(): void {
    if (this.totalEnviar() === 0 || this.enviando()) return;

    this.confirmationService.confirm({
      header: 'Confirmar envio',
      message: this.textoConfirmacao(),
      icon: 'pi pi-send',
      acceptLabel: `Enviar ${this.totalEnviar()}`,
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => this.enviar(),
    });
  }

  /** O texto diz os números por extenso: é a última chance de perceber o mês errado. */
  private textoConfirmacao(): string {
    const c = this.contagem();
    const partes = [
      `Enviar <strong>${this.totalEnviar()}</strong> holerite(s) de `
      + `<strong>${this.types.labelOf(this.tipo())}</strong> de `
      + `<strong>${this.competenciaLegivel()}</strong>?`,
    ];

    if (c.JA_ENVIADO) partes.push(`${c.JA_ENVIADO} já enviado(s) serão pulados.`);
    if (c.NAO_CADASTRADO) partes.push(`${c.NAO_CADASTRADO} não cadastrado(s) ficam de fora.`);
    if (c.CPF_DUPLICADO) partes.push(`${c.CPF_DUPLICADO} com CPF repetido ficam de fora.`);
    if (c.SEM_USUARIO) partes.push(`${c.SEM_USUARIO} receberão sem aviso, por não terem login.`);

    return partes.join('<br>');
  }

  competenciaLegivel(): string {
    if (!this.competencia()) return '';
    const [ano, mes] = this.competencia().split('-');
    const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${nomes[Number(mes) - 1]}/${ano}`;
  }

  private enviar(): void {
    this.enviando.set(true);

    this.service.vincular(this.arquivo()!, this.competencia(), this.tipo()).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.resultado.set(resultado);
        this.etapa.set('enviado');
        this.messageService.add({
          severity: resultado.vinculados > 0 ? 'success' : 'warn',
          summary: 'Envio concluído',
          detail: `${resultado.vinculados} holerite(s) enviado(s).`,
          life: 5000,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.erro(err, 'Não foi possível enviar os holerites.');
      },
    });
  }

  recomecar(): void {
    this.arquivo.set(null);
    this.competencia.set('');
    this.voltarParaEscolha();
  }

  private erro(err: HttpErrorResponse, padrao: string): void {
    const mensagem = err.status === 403
      ? 'Você não tem permissão para enviar holerites.'
      : typeof err.error === 'string' && err.error ? err.error : padrao;

    this.messageService.add({ severity: 'error', summary: 'Erro', detail: mensagem, life: 6000 });
  }
}
