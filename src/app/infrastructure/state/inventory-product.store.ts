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
   * A API devolve o produto enviado, sem o id nem os campos que ela completa —
   * não dá para fazer `upsert` com isso, então recarrega.
   */
  create(product: InventoryProduct): Observable<InventoryProduct> {
    return this.refreshAfter(this.service.addInventoryProduct(product));
  }

  update(product: InventoryProduct): Observable<InventoryProduct> {
    return this.refreshAfter(this.service.updateProduct(product));
  }

  private refreshAfter(source: Observable<InventoryProduct>): Observable<InventoryProduct> {
    return source.pipe(tap(() => this.refresh()));
  }
}
