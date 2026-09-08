import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkComboboxComponent } from '../../../theme/ProautoKimium/pk-combobox/pk-combobox.component';
import { PkEmptyComponent } from '../../../theme/ProautoKimium/pk-empty/pk-empty.component';
import { PkKpiComponent } from '../../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { formatarDecimal } from '../../../../domain/utils/decimal-br';
import { PreviaNewsletterService } from '../../../../infrastructure/services/newsletter/previa-newsletter.service';
import {
  semEmail,
  type ClienteDaNewsletter,
  type PendenciaDeHora,
  type PreviaNewsletter,
} from '../../../../domain/models/newsletter/previa.model';

/** O que a tela mostra num dado momento. */
export type EstadoDaTela = 'vazio' | 'carregando' | 'revisando' | 'jaConfirmado' | 'erro';

/**
 * Revisão da newsletter, antes de qualquer e-mail sair.
 *
 * O fluxo antigo passava por planilha: consulta à mão no Sankhya, exporta
 * Excel, sobe no sistema. Aqui a API busca no ERP e esta tela é onde os números
 * são conferidos.
 *
 * **A tela existe por causa das pendências.** A hora da ordem de serviço é
 * texto livre no ERP e vem em duas convenções; o que não cai em nenhuma delas
 * era descartado em silêncio — 82 das 350 OS de junho. Agora aparece, com o
 * texto original ao lado, para quem sabe decidir.
 */
@Component({
  selector: 'app-newsletter-revisao',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    PageHeaderComponent, PkComboboxComponent, PkEmptyComponent, PkKpiComponent,
  ],
  templateUrl: './newsletter-revisao.component.html',
  styleUrl: './newsletter-revisao.component.scss',
  providers: [MessageService],
})
export class NewsletterRevisaoComponent {

  private readonly service = inject(PreviaNewsletterService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Tabela no computador, cartoes no celular.
   *
   * `@if` e nao `display: none`: cada cartao tem campo de e-mail, e escondido
   * por CSS ele continua vivo no DOM — foco, tab e leitor de tela passariam
   * por um formulario invisivel.
   */
  readonly ehCelular = signal(false);

  constructor() {
    const celular = window.matchMedia('(max-width: 768px)');
    const aplicar = () => this.ehCelular.set(celular.matches);

    celular.addEventListener('change', aplicar);
    this.destroyRef.onDestroy(() => celular.removeEventListener('change', aplicar));
    aplicar();
  }

  // ── Período ───────────────────────────────────────────────────────────────

  private static readonly MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  readonly meses = NewsletterRevisaoComponent.MESES.map((label, i) => ({ label, value: i + 1 }));

  /**
   * Começa no mês passado, que é o que se manda: a newsletter de junho sai em
   * julho, quando o mês fechou.
   */
  private static readonly ANTERIOR = (() => {
    const hoje = new Date();
    const mes = hoje.getMonth();               // 0-11; 0 aqui já é dezembro do ano anterior
    return mes === 0
      ? { mes: 12, ano: hoje.getFullYear() - 1 }
      : { mes, ano: hoje.getFullYear() };
  })();

  readonly mes = signal(NewsletterRevisaoComponent.ANTERIOR.mes);
  readonly ano = signal(NewsletterRevisaoComponent.ANTERIOR.ano);

  readonly anos = (() => {
    const atual = new Date().getFullYear();
    return [atual, atual - 1, atual - 2];
  })();

  /**
   * Mês no futuro não tem dado — devolveria tudo zerado, e zero parece
   * resultado. Barra antes de sair a requisição.
   */
  readonly periodoNoFuturo = computed(() => {
    const hoje = new Date();
    const limite = hoje.getFullYear() * 12 + hoje.getMonth();  // mês corrente
    return this.ano() * 12 + (this.mes() - 1) >= limite;
  });

  // ── Estado ────────────────────────────────────────────────────────────────

  readonly estado = signal<EstadoDaTela>('vazio');
  readonly previa = signal<PreviaNewsletter | null>(null);
  readonly mensagemDeErro = signal<string | null>(null);

  readonly busca = signal('');
  readonly salvando = signal(false);

  /** Painel dos que não têm e-mail — aberto sob demanda, não empurrado na cara. */
  readonly painelDeEmails = signal(false);

  /** O que foi digitado no painel, por código de cliente, ainda não enviado. */
  readonly emailsDigitados = signal<Record<string, string>>({});

  // ── Listas derivadas ──────────────────────────────────────────────────────

  readonly clientes = computed(() => this.previa()?.clientes ?? []);
  readonly pendencias = computed<PendenciaDeHora[]>(() => this.previa()?.pendencias ?? []);

  readonly semEmailCadastrado = computed(() => this.clientes().filter(semEmail));

  /**
   * Ordenado por faturamento, do maior para o menor.
   *
   * São 913 linhas, e ninguém confere 913. Os maiores são onde um número errado
   * custa caro — então é por eles que a lista começa.
   */
  readonly clientesVisiveis = computed(() => {
    const termo = this.busca().trim().toLowerCase();

    const filtrados = termo
      ? this.clientes().filter(c =>
          c.nomeDoCliente.toLowerCase().includes(termo) ||
          c.codigoCliente.includes(termo))
      : this.clientes();

    return [...filtrados].sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);
  });

  readonly totalFaturamento = computed(() =>
    this.clientes().reduce((soma, c) => soma + (c.faturamentoTotal ?? 0), 0));

  /**
   * Quem faturou no mes.
   *
   * A lista de clientes vem inteira, e nem todos compraram: em junho foram 913
   * clientes para 855 com nota. O numero que se manda e o segundo, e por isso
   * ele aparece separado do total.
   */
  readonly comFaturamento = computed(() =>
    this.clientes().filter(c => (c.faturamentoTotal ?? 0) > 0).length);

  /** O que ja foi digitado para um cliente no painel, para o campo nao esquecer. */
  emailDigitado(codigoCliente: string): string {
    return this.emailsDigitados()[codigoCliente] ?? '';
  }

  readonly emailsPreenchidos = computed(() =>
    Object.values(this.emailsDigitados()).filter(e => e.trim().length > 0).length);

  dinheiro(valor: number): string {
    return `R$ ${formatarDecimal(valor ?? 0, 2)}`;
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  buscar(): void {
    if (this.periodoNoFuturo() || this.estado() === 'carregando') return;

    this.estado.set('carregando');
    this.mensagemDeErro.set(null);

    this.service.buscar(this.mes(), this.ano()).subscribe({
      next: previa => {
        this.previa.set(previa);
        this.emailsDigitados.set({});
        this.estado.set('revisando');
      },
      error: erro => {
        // 409 é o mês já confirmado, e não uma falha: a API recusa refazer
        // porque a newsletter dispara e-mail. A mensagem dela diz quando foi e
        // com quantos clientes — trocar por texto genérico apagaria isso.
        this.mensagemDeErro.set(
          erro?.error?.message ?? 'Não foi possível buscar a prévia no Sankhya.');
        this.estado.set(erro?.status === 409 ? 'jaConfirmado' : 'erro');
      },
    });
  }

  corrigirHora(pendencia: PendenciaDeHora, horaInicio: string, horaFim: string): void {
    const previa = this.previa();
    if (!previa || !horaInicio?.trim() || !horaFim?.trim()) return;

    this.service.corrigirHora(previa.id, pendencia.numeroOs, { horaInicio, horaFim }).subscribe({
      next: cliente => {
        // A API devolve o cliente recalculado; a tela troca a linha e some com
        // a pendência. Refazer a conta aqui criaria uma segunda fonte para o
        // mesmo número.
        this.substituirCliente(cliente);
        this.previa.update(p => p && ({
          ...p,
          pendencias: p.pendencias.filter(x => x.numeroOs !== pendencia.numeroOs),
        }));
      },
      error: erro => this.avisar(erro, 'Não foi possível gravar a correção.'),
    });
  }

  anotarEmail(codigoCliente: string, email: string): void {
    this.emailsDigitados.update(atual => ({ ...atual, [codigoCliente]: email }));
  }

  /** Manda todos de uma vez: 31 requisições para um trabalho só seria desperdício. */
  salvarEmails(): void {
    const previa = this.previa();
    if (!previa) return;

    const emails = Object.entries(this.emailsDigitados())
      .map(([codigo, email]) => ({ codigoCliente: codigo, email: email.trim() }))
      .filter(e => e.email.length > 0);

    if (!emails.length) return;

    this.salvando.set(true);
    this.service.preencherEmails(previa.id, emails).subscribe({
      next: atualizados => {
        atualizados.forEach(c => this.substituirCliente(c));
        this.emailsDigitados.set({});
        this.salvando.set(false);
        this.painelDeEmails.set(false);
        this.toast.add({
          severity: 'success', summary: 'Pronto',
          detail: `${atualizados.length} e-mail(s) preenchido(s).`,
        });
      },
      error: erro => {
        this.salvando.set(false);
        this.avisar(erro, 'Não foi possível gravar os e-mails.');
      },
    });
  }

  confirmar(): void {
    const previa = this.previa();
    if (!previa || this.salvando()) return;

    this.salvando.set(true);
    this.service.confirmar(previa.id).subscribe({
      next: () => {
        this.salvando.set(false);
        this.previa.set(null);
        this.estado.set('vazio');
        this.toast.add({
          severity: 'success', summary: 'Confirmado',
          detail: 'A newsletter foi liberada para envio.',
        });
      },
      error: erro => {
        this.salvando.set(false);
        this.avisar(erro, 'Não foi possível confirmar.');
      },
    });
  }

  semEmail = semEmail;

  // ── Bastidores ────────────────────────────────────────────────────────────

  private substituirCliente(cliente: ClienteDaNewsletter): void {
    this.previa.update(p => p && ({
      ...p,
      clientes: p.clientes.map(c =>
        c.codigoCliente === cliente.codigoCliente ? cliente : c),
    }));
  }

  private avisar(erro: unknown, padrao: string): void {
    const mensagem = (erro as { error?: { message?: string } })?.error?.message ?? padrao;
    this.toast.add({ severity: 'warn', summary: 'Erro', detail: mensagem });
  }
}
