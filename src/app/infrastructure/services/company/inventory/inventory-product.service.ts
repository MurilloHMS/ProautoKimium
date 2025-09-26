import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { InventoryMovement, InventoryProduct, InventoryProductResponse } from '../../../../domain/models/products.model';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InventoryProductService {

  constructor(private http: HttpClient) { }

  getInventoryProducts() {
    return this.http.get<InventoryProductResponse[]>(`${environment.apiUrl}/product/inventory/product`);
  }

  addInventoryProduct(product: InventoryProduct) {
    return this.http.post<InventoryProduct>(`${environment.apiUrl}/product/inventory/product`, product);
  }

  getInventoryMovementsByProduct(systemCode: number) {
    return this.http.get<InventoryMovement>(`${environment.apiUrl}/product/inventory/movements/${systemCode}`);
  }

  addInventoryMovement(movement: InventoryMovement) {
    return this.http.post<InventoryMovement>(`${environment.apiUrl}/product/inventory/movement`, movement);
  }

  updateProduct(product: InventoryProduct){
    return this.http.put<InventoryProduct>(`${environment.apiUrl}/product/inventory/product`, product);
  }
}
