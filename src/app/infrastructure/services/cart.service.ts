import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class CartService {
  private cart: any[] = JSON.parse(localStorage.getItem('cart') || '[]');
  private cartSubject = new BehaviorSubject<any[]>(this.cart);
  private cartCountSubject = new BehaviorSubject<number>(this.cart.length);

  constructor() {
    this.cartSubject.subscribe(cart => {
      localStorage.setItem('cart', JSON.stringify(cart));
      this.cartCountSubject.next(cart.length);
    });
  }

  getCart() {
    return this.cartSubject.asObservable();
  }

  getCartCount() {
    return this.cartCountSubject.asObservable();
  }

  addToCart(produto: any) {
    this.cart.push(produto);
    this.cartSubject.next([...this.cart]);
  }

  clearCart() {
    this.cart = [];
    this.cartSubject.next(this.cart);
    localStorage.removeItem('cart');
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
    this.cartSubject.next([...this.cart]);
    localStorage.setItem('cart', JSON.stringify(this.cart));
  }
}