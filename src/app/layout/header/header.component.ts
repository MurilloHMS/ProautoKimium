import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../infrastructure/services/cart.service';


@Component({
    selector: 'app-header',
    imports: [RouterLink],
    templateUrl: './header.component.html',
    styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  quantidadeProdutos = 0;
  menuAberto = false;

  toggleMenu() {
    this.menuAberto = !this.menuAberto;
  }

  constructor(private cartService: CartService) {}

  ngOnInit() {
      this.cartService.getCartCount().subscribe(count => {
        this.quantidadeProdutos = count;
      })
  }
}
