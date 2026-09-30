import { Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { ETAPAS } from '../../../../domain/utils/checklist/checklist-regras';
import { Rascunho } from '../../../../infrastructure/offline/checklist-db';
import { ChecklistOfflineStore } from '../../../../infrastructure/state/checklist-offline.store';
import { ChecklistSessao } from './checklist-sessao';
import { EtapaClienteComponent } from './etapas/etapa-cliente.component';
import { EtapaComodatoComponent } from './etapas/etapa-comodato.component';
import { EtapaContratoComponent } from './etapas/etapa-contrato.component';
import { EtapaEnderecoComponent } from './etapas/etapa-endereco.component';
import { EtapaInstalacaoComponent } from './etapas/etapa-instalacao.component';
import { EtapaPedidoComponent } from './etapas/etapa-pedido.component';
import { EtapaRevisaoComponent } from './etapas/etapa-revisao.component';
import { EtapaVisualComponent } from './etapas/etapa-visual.component';

/** Meio segundo depois da última tecla: salva sem gravar a cada letra. */
export const ESPERA_PARA_SALVAR = 500;

/**
 * O checklist aberto, uma etapa por tela (aprovado no mockup de 2026-09-29).
 *
 * <p>Salva no aparelho meio segundo depois de cada mudança, e ao trocar de
 * etapa. "Continuar" nunca trava: quem não sabe um dado agora passa adiante, e
 * a etapa 8 mostra o que falta. O erro aparece junto do campo só depois que a
 * pessoa já passou pela etapa — um formulário vermelho antes de digitar
 * qualquer coisa assusta.
 */
@Component({
  selector: 'app-checklist-formulario',
  standalone: true,
  imports: [
    EtapaClienteComponent, EtapaEnderecoComponent, EtapaContratoComponent, EtapaInstalacaoComponent,
    EtapaComodatoComponent, EtapaVisualComponent, EtapaPedidoComponent, EtapaRevisaoComponent,
  ],
  providers: [ChecklistSessao],
  templateUrl: './checklist-formulario.component.html',
  styleUrl: './checklist-formulario.component.scss',
})
export class ChecklistFormularioComponent implements OnInit {

  protected readonly store = inject(ChecklistOfflineStore);
  protected readonly s = inject(ChecklistSessao);

  readonly rascunho = input.required<Rascunho>();
  readonly fechar = output<void>();
  /** `true` quando foi enviado na hora; `false` quando ficou esperando internet. */
  readonly enviado = output<boolean>();

  protected readonly etapas = ETAPAS;
  protected readonly etapa = signal(1);
  protected readonly info = computed(() => ETAPAS[this.etapa() - 1]);
  protected readonly progresso = computed(() => Math.round((this.etapa() / ETAPAS.length) * 100));
  protected readonly enviando = signal(false);
  protected readonly salvo = signal(true);
  /** O aparelho recusou gravar (armazenamento cheio, navegador em modo restrito). */
  protected readonly falhaAoSalvar = signal(false);
  /** O servidor recusou o envio: a frase dele, no topo, até a pessoa enviar de novo. */
  protected readonly recusa = signal<string | null>(null);

  private readonly corpo = viewChild<ElementRef<HTMLElement>>('corpo');
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pronto = false;

  constructor() {
    // Qualquer mudança no conteúdo agenda o salvamento.
    effect(() => {
      this.s.conteudo();
      this.etapa();
      if (!untracked(() => this.pronto)) return;
      untracked(() => this.agendar());
    });
    inject(DestroyRef).onDestroy(() => void this.salvarAgora());
  }

  ngOnInit(): void {
    const r = this.rascunho();
    this.s.conteudo.set(structuredClone(r.conteudo));
    this.etapa.set(Math.min(Math.max(r.etapa, 1), ETAPAS.length));
    // Reabrindo um rascunho, as etapas anteriores já foram vistas.
    this.s.visitadas.set(new Set(Array.from({ length: this.etapa() - 1 }, (_, i) => i + 1)));
    this.pronto = true;
  }

  private agendar(): void {
    this.salvo.set(false);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.salvarAgora(), ESPERA_PARA_SALVAR);
  }

  async salvarAgora(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.pronto) return;
    try {
      await this.store.salvarRascunho({ ...this.rascunho(), conteudo: this.s.conteudo(), etapa: this.etapa() });
      this.salvo.set(true);
      this.falhaAoSalvar.set(false);
    } catch {
      // Sem isso a tela diria "Salvando…" para sempre, e a pessoa confiaria
      // num rascunho que não existe.
      this.falhaAoSalvar.set(true);
    }
  }

  protected ir(etapa: number): void {
    this.s.visitadas.update(v => new Set([...v, this.etapa()]));
    this.etapa.set(etapa);
    void this.salvarAgora();
    this.corpo()?.nativeElement.scrollTo({ top: 0 });
  }

  protected continuar(): void {
    if (this.etapa() < ETAPAS.length) this.ir(this.etapa() + 1);
  }

  protected voltar(): void {
    if (this.etapa() > 1) this.ir(this.etapa() - 1);
    else void this.sair();
  }

  protected async sair(): Promise<void> {
    await this.salvarAgora();
    this.fechar.emit();
  }

  protected async enviar(): Promise<void> {
    // Na etapa 8 todas as etapas contam como vistas: o erro aparece em cada uma.
    this.s.visitadas.set(new Set(ETAPAS.map(e => e.numero)));
    if (this.s.problemas().length || this.enviando()) return;
    this.enviando.set(true);
    this.recusa.set(null);
    try {
      await this.salvarAgora();
      this.pronto = false;
      const desfecho = await this.store.enviar({ ...this.rascunho(), conteudo: this.s.conteudo(), etapa: this.etapa() });
      if (desfecho.tipo === 'recusado') {
        await this.voltarDaRecusa(desfecho.motivo);
        return;
      }
      this.enviado.emit(desfecho.tipo === 'enviado');
    } finally {
      this.enviando.set(false);
    }
  }

  /**
   * O servidor recusou: o checklist volta a ser rascunho e a pessoa continua
   * aqui, na etapa do problema, com a frase do servidor em cima. Ir para a
   * tela de fim diria "enviado" sobre algo que não foi.
   */
  private async voltarDaRecusa(motivo: string): Promise<void> {
    const item = this.store.recusados().find(f => f.id === this.rascunho().id);
    if (item) await this.store.corrigirRecusado(item);
    this.recusa.set(motivo);
    this.pronto = true;
    const etapa = Number(/^Etapa (\d+)/.exec(motivo)?.[1]);
    if (etapa >= 1 && etapa <= ETAPAS.length) this.ir(etapa);
  }
}
