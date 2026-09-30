import { Component, computed, inject, signal } from '@angular/core';
import { ChecklistCatalog } from '../../../../../domain/models/sales/checklist.model';
import { buscarComodato } from '../../../../../domain/utils/checklist/checklist-catalogo';
import { ChecklistSessao } from '../checklist-sessao';
import { QuantidadeComponent } from '../ui/quantidade.component';

type ItemDoCatalogo = ChecklistCatalog['comodato'][number];

/**
 * Etapa 5 — equipamentos em comodato. A lista é a que a Controladoria escolhe
 * do Sankhya; a busca acha pelo nome do dia a dia ("dosador frigorífico") e
 * mostra o técnico embaixo. "Não achei" é texto livre, como na planilha.
 */
@Component({
  selector: 'ck-etapa-comodato',
  standalone: true,
  imports: [QuantidadeComponent],
  templateUrl: './etapa-comodato.component.html',
  styleUrl: './etapa.scss',
})
export class EtapaComodatoComponent {

  protected readonly s = inject(ChecklistSessao);
  protected readonly busca = signal('');

  protected readonly k = computed(() => this.s.conteudo().comodato ?? { items: [], extraItems: [], notes: null });
  private readonly escolhidos = computed(() => new Set(this.k().items.map(i => i.productCode)));

  protected readonly resultados = computed(() => {
    const indice = this.s.indice();
    if (!indice) return [];
    return buscarComodato(indice, this.busca()).filter(i => !this.escolhidos().has(i.productCode));
  });

  protected pegar(item: ItemDoCatalogo): void {
    this.s.atualizar(c => {
      c.comodato ??= { items: [], extraItems: [], notes: null };
      c.comodato.items.push({ productCode: item.productCode, name: item.name, popularName: item.popularName, quantity: 1 });
    });
  }

  protected quantidade(codigo: number, qtd: number): void {
    this.s.atualizar(c => {
      const item = c.comodato?.items.find(i => i.productCode === codigo);
      if (item) item.quantity = qtd;
    });
  }

  protected tirar(codigo: number): void {
    this.s.atualizar(c => { if (c.comodato) c.comodato.items = c.comodato.items.filter(i => i.productCode !== codigo); });
  }

  protected naoAchei(): void {
    this.s.atualizar(c => {
      c.comodato ??= { items: [], extraItems: [], notes: null };
      c.comodato.extraItems.push({ description: this.busca().trim(), quantity: 1 });
    });
    this.busca.set('');
  }

  protected extra(n: number, campo: 'description' | 'quantity', valor: string | number): void {
    this.s.atualizar(c => {
      const item = c.comodato?.extraItems[n];
      if (!item) return;
      if (campo === 'description') item.description = String(valor);
      else item.quantity = Number(valor);
    });
  }

  protected tirarExtra(n: number): void {
    this.s.atualizar(c => c.comodato?.extraItems.splice(n, 1));
  }

  protected notas(texto: string): void {
    this.s.atualizar(c => {
      c.comodato ??= { items: [], extraItems: [], notes: null };
      c.comodato.notes = texto || null;
    });
  }
}
