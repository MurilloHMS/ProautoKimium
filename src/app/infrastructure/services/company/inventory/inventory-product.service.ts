import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { InventoryMovement, InventoryProduct, InventoryProductResponse } from '../../../../domain/models/products.model';
import { environment } from '../../../../../environments/environment';

/**
 * Estoque (ProStock).
 *
 * As URLs estavam em `/product/inventory/...`, mas a API serve `/inventory/...`
 * (`prostock/ProductController`, mapeado em `api/inventory`). Todas as chamadas
 * respondiam 404 — por isso a tela nunca entrou no menu.
 *
 * O desktop JavaFX continua no ar consumindo os mesmos endpoints, então nada
 * aqui pode presumir contrato diferente do que ele já usa.
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryProductService {

  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/inventory`;

  getInventoryProducts(): Observable<InventoryProductResponse[]> {
    return this.http.get<InventoryProductResponse[]>(`${this.url}/product`);
  }

  /** Produtos cujo estoque atual está abaixo do mínimo cadastrado. */
  getLowStockProducts(): Observable<InventoryProductResponse[]> {
    return this.http.get<InventoryProductResponse[]>(`${this.url}/product/lowstock`);
  }

  addInventoryProduct(product: InventoryProduct): Observable<unknown> {
    return this.http.post(`${this.url}/product`, product);
  }

  updateProduct(product: InventoryProduct): Observable<unknown> {
    return this.http.put(`${this.url}/product`, product);
  }

  deleteProduct(systemCode: string): Observable<unknown> {
    return this.http.delete(`${this.url}/product/${systemCode}`);
  }

  /** Histórico do produto, em ordem cronológica: o último é o estoque atual. */
  getInventoryMovementsByProduct(systemCode: string): Observable<InventoryMovement[]> {
    return this.http.get<InventoryMovement[]>(`${this.url}/movements/${systemCode}`);
  }

  /** `quantity` é o estoque resultante, não a diferença — ver InventoryMovement. */
  addInventoryMovement(movement: InventoryMovement): Observable<unknown> {
    return this.http.post(`${this.url}/movement`, movement);
  }

  /** Planilha de produtos em lote. A API responde texto com o resultado. */
  uploadProductSheet(file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file);

    return this.http.post(`${this.url}/product/upload`, form, { responseType: 'text' });
  }

  /**
   * Posição do estoque numa data, em `.xlsx`. Observa a resposta inteira porque
   * o nome do arquivo vem no `Content-Disposition`.
   */
  getMovementsReport(date: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/movements/reports/${date}`, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}
