import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CatalogProduct, OrderKind } from '../../../../../domain/models/sales/checklist.model';
import { PrecoDoProduto, produtosDoPedido } from '../../../../../domain/utils/checklist/checklist-catalogo';
import { totalDaLinha, totalDoPedido } from '../../../../../domain/utils/checklist/checklist-regras';
import { lerDecimal } from '../../../../../domain/utils/decimal-br';
import { ChecklistSessao } from '../checklist-sessao';
import { OpcoesComponent } from '../ui/opcoes.component';
import { QuantidadeComponent } from '../ui/quantidade.component';
import { SimNaoComponent } from '../ui/sim-nao.component';

/**
 * Etapa 7 — pedido (opcional). Os produtos vêm da tabela de preço do cliente e,
 * para o que ela não tem, da tabela geral (80). O preço fica congelado no
 * checklist, com a tabela de onde saiu.
 *
 * A quantidade é em embalagens; o preço é por KG/LT, como no Sankhya. A conta
 * aparece por extenso ("3 × 20 LT × R$ 10,98"), porque é a da planilha.
 */
@Component({
  selector: 'ck-etapa-pedido',
  standalone: true,
  imports: [SimNaoComponent, OpcoesComponent, QuantidadeComponent, CurrencyPipe, DecimalPipe],
  templateUrl: './etapa-pedido.component.html',
  styleUrl: './etapa-pedido.component.scss',
})
export class EtapaPedidoComponent {

  protected readonly s = inject(ChecklistSessao);
  protected readonly busca = signal('');
  protected readonly procurando = signal(false);

  protected readonly tipos: { valor: OrderKind; rotulo: string }[] = [
    { valor: 'VENDA', rotulo: 'Venda' },
    { valor: 'BONIFICADO', rotulo: 'Bonificado' },
  ];

  protected readonly o = computed(() => this.s.conteudo().order ?? { enabled: false, kind: 'VENDA' as OrderKind, items: [], total: null });
  protected readonly tabela = computed(() => this.s.conteudo().customer?.priceTable ?? null);
  protected readonly total = computed(() => totalDoPedido(this.o().items));

  protected readonly opcoes = computed(() => {
    const indice = this.s.indice();
    if (!indice || !this.procurando()) return [];
    const ja = new Set(this.o().items.map(i => i.productCode));
    return produtosDoPedido(indice, this.tabela(), this.busca()).filter(x => !ja.has(x.produto.code));
  });

  protected readonly linha = totalDaLinha;

  protected temPedido(sim: boolean | null): void {
    this.s.atualizar(c => {
      c.order ??= { enabled: false, kind: 'VENDA', items: [], total: null };
      c.order.enabled = sim === true;
    });
    if (sim) this.procurando.set(!this.o().items.length);
  }

  protected tipo(kind: OrderKind | null): void {
    this.s.atualizar(c => { if (c.order) c.order.kind = kind; });
  }

  protected adicionar(p: CatalogProduct, preco: PrecoDoProduto): void {
    this.s.atualizar(c => {
      c.order ??= { enabled: true, kind: 'VENDA', items: [], total: null };
      c.order.items.push({
        productCode: p.code, name: p.name, unit: p.unit, packageSize: p.packageSize, packageLabel: p.packageLabel,
        packages: 1, unitPrice: preco.preco, ipiPercent: p.ipi ?? 0, priceTable: preco.tabela,
        priceSource: preco.origem, tablePrice: preco.preco, lineTotal: null,
      });
      c.order.total = totalDoPedido(c.order.items);
    });
    this.busca.set('');
    this.procurando.set(false);
  }

  protected embalagens(codigo: number, qtd: number): void {
    this.mudarItem(codigo, i => { i.packages = qtd; });
  }

  protected tamanho(codigo: number, texto: string): void {
    const valor = lerDecimal(texto);
    this.mudarItem(codigo, i => { i.packageSize = valor && valor > 0 ? valor : null; });
  }

  /**
   * O preço de venda: começa no da tabela e o vendedor pode mudar (pedido
   * dele, 2026-09-30). O da tabela fica guardado ao lado, para a Controladoria.
   */
  protected preco(codigo: number, texto: string): void {
    const valor = lerDecimal(texto);
    if (valor === null || valor < 0) return;
    this.mudarItem(codigo, i => { i.unitPrice = valor; });
  }

  protected voltarAoPrecoDaTabela(codigo: number): void {
    this.mudarItem(codigo, i => { if (i.tablePrice !== null) i.unitPrice = i.tablePrice; });
  }

  protected alterado(item: { unitPrice: number | null; tablePrice: number | null }): boolean {
    return item.tablePrice !== null && item.unitPrice !== null && item.unitPrice !== item.tablePrice;
  }

  protected tirar(codigo: number): void {
    this.s.atualizar(c => {
      if (!c.order) return;
      c.order.items = c.order.items.filter(i => i.productCode !== codigo);
      c.order.total = totalDoPedido(c.order.items);
    });
  }

  /** Veio do nome do produto ("20 LT"), e não do cadastro: o vendedor confere. */
  protected tamanhoDoNome(codigo: number): boolean {
    return this.s.indice()?.produtos.get(codigo)?.packageFromName ?? false;
  }

  private mudarItem(codigo: number, mudar: (i: NonNullable<ReturnType<typeof this.o>>['items'][number]) => void): void {
    this.s.atualizar(c => {
      const item = c.order?.items.find(i => i.productCode === codigo);
      if (!item || !c.order) return;
      mudar(item);
      item.lineTotal = totalDaLinha(item);
      c.order.total = totalDoPedido(c.order.items);
    });
  }
}
