import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CHECKLIST_EVENT, CHECKLIST_STATUS, ChecklistDetail, ChecklistSummary, editavel,
} from '../../../../domain/models/sales/checklist.model';
import { apiMessageOrFallback } from '../../../../domain/utils/api-error';
import { ItemDaFila, Rascunho } from '../../../../infrastructure/offline/checklist-db';
import { ChecklistApiService } from '../../../../infrastructure/services/sales/checklist-api.service';
import { ChecklistOfflineStore } from '../../../../infrastructure/state/checklist-offline.store';
import { camadaVoltavel } from '../../../../infrastructure/state/camada-voltavel';
import { ChecklistFormularioComponent } from './checklist-formulario.component';

type Modo = 'inicio' | 'formulario' | 'fim' | 'detalhe';

/**
 * O checklist de vendas do vendedor (`vendas/checklist`), pensado para o
 * celular e para quem tem pouca intimidade com ele.
 *
 * <p>A lista começa pelo que pede ação: o que o servidor recusou, o que espera
 * internet, o que está pela metade. Depois, os enviados. Tudo isso abre sem
 * internet — vem do aparelho.
 */
@Component({
  selector: 'app-checklist',
  standalone: true,
  imports: [ChecklistFormularioComponent, DatePipe, CurrencyPipe],
  templateUrl: './checklist.component.html',
  styleUrl: './checklist.component.scss',
})
export class ChecklistComponent implements OnInit {

  protected readonly store = inject(ChecklistOfflineStore);
  private readonly api = inject(ChecklistApiService);

  protected readonly modo = signal<Modo>('inicio');
  protected readonly aberto = signal<Rascunho | null>(null);
  protected readonly foiAgora = signal(false);

  protected readonly detalhe = signal<ChecklistDetail | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly pedindoAlteracao = signal(false);
  protected readonly motivo = signal('');
  protected readonly processando = signal(false);
  protected readonly confirmarDescarte = signal<string | null>(null);

  protected readonly status = CHECKLIST_STATUS;
  protected readonly eventos = CHECKLIST_EVENT;
  protected readonly editavel = editavel;

  /** Enviados que ainda estão na fila não aparecem duas vezes. */
  protected readonly enviados = computed(() => {
    const naFila = new Set(this.store.fila().map(f => f.id));
    const rascunhos = new Set(this.store.rascunhos().map(r => r.id));
    return this.store.enviados().filter(e => !naFila.has(e.id) && !rascunhos.has(e.id));
  });

  private readonly camada = camadaVoltavel(() => this.fecharCamada());

  ngOnInit(): void {
    void this.store.iniciar();
  }

  private fecharCamada(): void {
    if (this.modo() !== 'inicio') this.voltarAoInicio();
  }

  // ── Formulário ───────────────────────────────────────────────────────────

  protected async novo(): Promise<void> {
    this.abrir(await this.store.novoRascunho());
  }

  protected abrir(r: Rascunho): void {
    this.aberto.set(r);
    this.modo.set('formulario');
    this.camada.empilhar();
  }

  protected concluido(agora: boolean): void {
    this.foiAgora.set(agora);
    this.aberto.set(null);
    this.modo.set('fim');
  }

  protected voltarAoInicio(): void {
    this.aberto.set(null);
    this.detalhe.set(null);
    this.pedindoAlteracao.set(false);
    this.erro.set(null);
    this.modo.set('inicio');
  }

  protected async corrigirRecusado(item: ItemDaFila): Promise<void> {
    this.abrir(await this.store.corrigirRecusado(item));
  }

  protected async descartar(id: string): Promise<void> {
    await this.store.descartarRascunho(id);
    this.confirmarDescarte.set(null);
  }

  // ── Enviados ─────────────────────────────────────────────────────────────

  protected async verEnviado(s: ChecklistSummary): Promise<void> {
    this.modo.set('detalhe');
    this.camada.empilhar();
    this.detalhe.set(null);
    this.erro.set(null);
    this.carregando.set(true);
    try {
      this.detalhe.set(await firstValueFrom(this.api.detalhe(s.id)));
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível abrir este checklist.'));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async corrigirEnviado(): Promise<void> {
    const d = this.detalhe();
    if (!d) return;
    const r = await this.store.corrigirEnviado(d);
    this.detalhe.set(null);
    this.aberto.set(r);
    this.modo.set('formulario');
  }

  protected async enviarPedido(): Promise<void> {
    const d = this.detalhe();
    if (!d || !this.motivo().trim() || this.processando()) return;
    this.processando.set(true);
    this.erro.set(null);
    try {
      this.detalhe.set(await firstValueFrom(this.api.pedirAlteracao(d.summary.id, this.motivo().trim())));
      this.pedindoAlteracao.set(false);
      this.motivo.set('');
    } catch (err) {
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível pedir a alteração.'));
    } finally {
      this.processando.set(false);
    }
  }

  /**
   * O comprovante abre numa aba. O link é criado e clicado na hora do toque: o
   * Safari do iPhone bloqueia `window.open` depois de um `await`.
   */
  protected async comprovante(id: string): Promise<void> {
    const aba = window.open('', '_blank');
    try {
      const pdf = await firstValueFrom(this.api.pdf(id));
      const url = URL.createObjectURL(pdf);
      if (aba) aba.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      aba?.close();
      this.erro.set(await apiMessageOrFallback(err, 'Não foi possível abrir o comprovante.'));
    }
  }

  protected podePedirAlteracao(d: ChecklistDetail): boolean {
    return d.summary.status === 'SUBMITTED' || d.summary.status === 'APPROVED';
  }
}
