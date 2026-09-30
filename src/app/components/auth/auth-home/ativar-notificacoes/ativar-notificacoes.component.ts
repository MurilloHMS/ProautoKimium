import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { PushNotificationService } from '../../../../infrastructure/services/push-notification.service';

/** Por quantos dias o "Agora não" esconde o convite neste aparelho. */
export const DISPENSADO_POR_DIAS = 30;
const DISPENSADO_KEY = 'pk-notificacoes-convite-dispensado-em';

/**
 * "Ative as notificações", na home, para quem ainda não ativou neste aparelho
 * (pedido dele, 2026-09-30). O serviço de push já sabia ativar, e nenhuma
 * tela o chamava: ninguém tinha como ligar.
 *
 * Só aparece quando há o que fazer com um toque. Não aparece sem suporte (dev
 * sem service worker, iPhone fora do app instalado — ali quem fala é a faixa
 * "Instalar"), nem quando a pessoa bloqueou: o navegador não deixa o site
 * perguntar de novo, e um botão que não faz nada é pior que nenhum.
 */
@Component({
  selector: 'app-ativar-notificacoes',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './ativar-notificacoes.component.html',
  styleUrl: './ativar-notificacoes.component.scss',
})
export class AtivarNotificacoesComponent implements OnInit {

  private readonly push = inject(PushNotificationService);

  protected readonly estado = signal<'oculto' | 'convite' | 'ativando' | 'pronto' | 'erro'>('oculto');
  protected readonly erro = signal('');

  async ngOnInit(): Promise<void> {
    if (dispensadoRecentemente()) return;
    if (await this.push.status() === 'available') this.estado.set('convite');
  }

  async ativar(): Promise<void> {
    if (this.estado() === 'ativando') return;
    this.estado.set('ativando');
    if (await this.push.enable()) {
      this.estado.set('pronto');
      return;
    }
    // Recusou na janelinha do navegador: dali em diante só pelas configurações.
    this.erro.set(await this.push.status() === 'denied'
      ? 'O navegador bloqueou as notificações. Para receber, libere nas configurações do site.'
      : 'Não deu para ativar agora. Tente de novo em instantes.');
    this.estado.set('erro');
  }

  agoraNao(): void {
    try { localStorage.setItem(DISPENSADO_KEY, String(Date.now())); } catch { /* sem armazenamento, volta na próxima visita */ }
    this.estado.set('oculto');
  }

  fechar(): void {
    this.estado.set('oculto');
  }
}

function dispensadoRecentemente(): boolean {
  try {
    const em = Number(localStorage.getItem(DISPENSADO_KEY));
    return em > 0 && Date.now() - em < DISPENSADO_POR_DIAS * 86_400_000;
  } catch {
    return false;
  }
}
