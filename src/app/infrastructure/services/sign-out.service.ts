import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ChecklistOfflineStore, PendingChecklists } from '../state/checklist-offline.store';

/**
 * A saída do sistema, num lugar só: o "Sair" do topo e o "Sair da conta" do
 * Perfil passam por aqui.
 *
 * Checklist que não chegou à Controladoria fica guardado no aparelho, preso ao
 * login, e só sai quando a MESMA pessoa entra de novo no MESMO aparelho. Sair
 * sem saber disso é como o checklist se perde na prática — por isso, havendo
 * pendência, a saída espera a pessoa decidir (pedido dele, 2026-09-30). Sem
 * pendência, sai como sempre saiu.
 */
@Injectable({ providedIn: 'root' })
export class SignOutService {

  private readonly auth = inject(AuthService);
  private readonly checklists = inject(ChecklistOfflineStore);

  /** O que está pendente enquanto o aviso está aberto; nulo com o aviso fechado. */
  readonly warning = signal<PendingChecklists | null>(null);
  readonly sending = signal(false);
  readonly online = this.checklists.online;

  async signOut(): Promise<void> {
    const pending = await this.checklists.pendingItems();
    if (total(pending) === 0) {
      this.signOutAnyway();
      return;
    }
    this.warning.set(pending);
  }

  /** "Enviar agora": tenta a fila; se não sobrar nada, sai sozinho. */
  async sendNow(): Promise<void> {
    if (this.sending()) return;
    this.sending.set(true);
    try {
      await this.checklists.sincronizar();
      const pending = await this.checklists.pendingItems();
      if (total(pending) === 0) this.signOutAnyway();
      else this.warning.set(pending);
    } finally {
      this.sending.set(false);
    }
  }

  stay(): void {
    this.warning.set(null);
  }

  /**
   * Espera o servidor encerrar a sessão antes de sair da tela. A navegação vai
   * no `subscribe`, e não em seguida: `window.location.href` descarrega a
   * página, e uma requisição em voo nessa hora é cancelada pelo navegador — a
   * sessão continuaria viva do lado de lá.
   */
  signOutAnyway(): void {
    this.warning.set(null);
    this.auth.logoutRemoto().subscribe(() => this.goHome());
  }

  /** Recarrega na raiz, limpando o estado da sessão. Separado para o teste não recarregar o Karma. */
  goHome(): void {
    window.location.href = '/';
  }
}

function total(p: PendingChecklists): number {
  return p.waiting + p.refused + p.drafts;
}
