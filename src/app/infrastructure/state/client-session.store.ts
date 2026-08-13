import { Injectable, computed, inject, signal } from '@angular/core';

import { ClientMe, ClientUnit } from '../../domain/models/client.model';
import { ClientService } from '../services/client/client.service';

/**
 * Sessão do portal: quem está logado e qual unidade está sendo olhada.
 *
 * Mora num store porque duas partes dependem disso e nenhuma é dona: o
 * cabeçalho escolhe a unidade e a dashboard consome. Passar por `input` faria
 * o layout ter que conhecer cada tela que vier depois.
 */
@Injectable({ providedIn: 'root' })
export class ClientSessionStore {

  private readonly service = inject(ClientService);

  readonly me = signal<ClientMe | null>(null);
  readonly loading = signal(false);
  readonly error = signal<'auth' | 'network' | null>(null);

  /** Vazio significa "todas as que eu vejo" — é o padrão da matriz. */
  readonly selectedUnits = signal<string[]>([]);

  readonly units = computed<ClientUnit[]>(() => this.me()?.unidades ?? []);
  readonly isMatriz = computed(() => this.me()?.matriz ?? false);

  /** O que a tela está mostrando agora, em texto. */
  readonly scopeLabel = computed(() => {
    const selected = this.selectedUnits();
    const units = this.units();

    if (selected.length === 1) {
      return units.find(unit => unit.codParceiro === selected[0])?.nome ?? selected[0];
    }
    if (selected.length > 1) return `${selected.length} unidades`;

    return this.isMatriz() ? 'Todas as unidades' : (this.me()?.nome ?? '');
  });

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.me().subscribe({
      next: me => {
        this.me.set(me);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        // 401/403 é sessão vencida ou usuário sem cliente vinculado — quem
        // trata é o layout, mandando para o login. Erro de rede é diferente:
        // vale oferecer "tentar de novo" em vez de derrubar a sessão.
        this.error.set(err.status === 401 || err.status === 403 ? 'auth' : 'network');
      },
    });
  }

  select(codParceiro: string | null): void {
    this.selectedUnits.set(codParceiro ? [codParceiro] : []);
  }

  clear(): void {
    this.me.set(null);
    this.selectedUnits.set([]);
    this.error.set(null);
  }
}
