import { Injectable, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { InventoryProduct, InventoryProductResponse } from '../../domain/models/products.model';
import { InventoryProductService } from '../services/company/inventory/inventory-product.service';
import { ReferenceStore } from './reference-store';

/**
 * Produtos do estoque.
 *
 * Mesmo contrato dos outros cadastros: a tela não guarda cópia da lista. É o
 * que vai servir a tela de movimentação, que precisa escolher o produto —
 * cadastrar um produto aparece lá sem recarregar.
 */
@Injectable({ providedIn: 'root' })
export class InventoryProductStore extends ReferenceStore<InventoryProductResponse> {

  private readonly service = inject(InventoryProductService);

  protected fetch(): Observable<InventoryProductResponse[]> { return this.service.getInventoryProducts(); }
  protected idOf(item: InventoryProductResponse): string { return item.id; }

  readonly options = computed(() =>
    this.items().map(product => ({ label: product.name, value: product.systemCode })));

  /**
   * A API não devolve o produto salvo (responde 201 sem corpo), então não há o
   * que dar `upsert` — recarregar é o que mantém a lista fiel ao servidor.
   */
  create(product: InventoryProduct): Observable<unknown> {
    return this.refreshAfter(this.service.addInventoryProduct(product));
  }

  update(product: InventoryProduct): Observable<unknown> {
    return this.refreshAfter(this.service.updateProduct(product));
  }

  /**
   * Produtos abaixo do mínimo. Fica fora do `items()` de propósito: é uma
   * consulta derivada, não outra lista — a tela usa para marcar e filtrar.
   */
  lowStock(): Observable<InventoryProductResponse[]> {
    return this.service.getLowStockProducts();
  }

  /** Apaga no servidor. O `remove` da base só tira da lista local. */
  deleteById(systemCode: string): Observable<unknown> {
    return this.refreshAfter(this.service.deleteProduct(systemCode));
  }

  /** A planilha mexe em muitas linhas de uma vez; só recarregando dá para saber quais. */
  uploadSheet(file: File): Observable<string> {
    return this.service.uploadProductSheet(file).pipe(tap(() => this.refresh()));
  }

  private refreshAfter<T>(source: Observable<T>): Observable<T> {
    return source.pipe(tap(() => this.refresh()));
  }
}
