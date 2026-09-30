import { Component, computed, inject, signal } from '@angular/core';
import { CatalogProduct } from '../../../../../domain/models/sales/checklist.model';
import { buscarVendaveis } from '../../../../../domain/utils/checklist/checklist-catalogo';
import { ChecklistSessao } from '../checklist-sessao';
import { QuantidadeComponent } from '../ui/quantidade.component';
import { SimNaoComponent } from '../ui/sim-nao.component';

/**
 * Etapa 6 — comunicação visual e técnica. Duas listas, como ele leu a
 * planilha: os itens (guias, adesivos) com quantidade; e os produtos usados
 * na implantação, cada um com etiquetas e diluição.
 */
@Component({
  selector: 'ck-etapa-visual',
  standalone: true,
  imports: [QuantidadeComponent, SimNaoComponent],
  templateUrl: './etapa-visual.component.html',
  styleUrl: './etapa-visual.component.scss',
})
export class EtapaVisualComponent {

  protected readonly s = inject(ChecklistSessao);
  protected readonly busca = signal('');

  protected readonly v = computed(() => this.s.conteudo().visual ?? { items: [], products: [], technicalDocs: null, technicalDocsEmail: null });

  /** A lista da Controladoria; sem catálogo, os itens já marcados neste checklist. */
  protected readonly itens = computed(() => {
    const doCatalogo = this.s.indice()?.catalogo.visualItems ?? [];
    const marcados = this.v().items;
    const nomes = new Set(doCatalogo.map(i => i.name));
    return [
      ...doCatalogo.map(i => ({ id: i.id, name: i.name })),
      ...marcados.filter(m => !nomes.has(m.name)).map(m => ({ id: m.itemId, name: m.name })),
    ];
  });

  protected readonly resultados = computed(() => {
    const indice = this.s.indice();
    const usados = new Set(this.v().products.map(p => p.productCode));
    return indice && this.busca().trim().length >= 2
      ? buscarVendaveis(indice, this.busca()).filter(p => !usados.has(p.code)).slice(0, 12)
      : [];
  });

  protected qtd(nome: string): number {
    return this.v().items.find(i => i.name === nome)?.quantity ?? 0;
  }

  /** Quantidade zero tira o item: só vai para o checklist o que o cliente recebe. */
  protected mudarQtd(id: string | null, nome: string, qtd: number): void {
    this.s.atualizar(c => {
      c.visual ??= { items: [], products: [], technicalDocs: null, technicalDocsEmail: null };
      const lista = c.visual.items.filter(i => i.name !== nome);
      if (qtd > 0) lista.push({ itemId: id, name: nome, quantity: qtd });
      const ordem = this.itens().map(i => i.name);
      c.visual.items = lista.sort((a, b) => ordem.indexOf(a.name) - ordem.indexOf(b.name));
    });
  }

  protected usar(p: CatalogProduct): void {
    this.s.atualizar(c => {
      c.visual ??= { items: [], products: [], technicalDocs: null, technicalDocsEmail: null };
      c.visual.products.push({ productCode: p.code, name: p.name, equipmentLabel: false, bottleLabel: false, dilution: null });
    });
    this.busca.set('');
  }

  protected produto(codigo: number, campo: 'equipmentLabel' | 'bottleLabel' | 'dilution', valor: boolean | string): void {
    this.s.atualizar(c => {
      const p = c.visual?.products.find(x => x.productCode === codigo);
      if (!p) return;
      if (campo === 'dilution') p.dilution = (valor as string) || null;
      else p[campo] = valor as boolean;
    });
  }

  protected tirarProduto(codigo: number): void {
    this.s.atualizar(c => { if (c.visual) c.visual.products = c.visual.products.filter(p => p.productCode !== codigo); });
  }

  protected docs(valor: boolean | null): void {
    this.s.atualizar(c => {
      c.visual ??= { items: [], products: [], technicalDocs: null, technicalDocsEmail: null };
      c.visual.technicalDocs = valor;
      // O e-mail das notas é quase sempre o mesmo: vem preenchido, e dá para trocar.
      if (valor && !c.visual.technicalDocsEmail) c.visual.technicalDocsEmail = c.customer?.invoiceEmail ?? null;
    });
  }

  protected emailDocs(texto: string): void {
    this.s.atualizar(c => { if (c.visual) c.visual.technicalDocsEmail = texto.trim() || null; });
  }
}
