import { Component } from '@angular/core';
import { categorias, produtos } from '../../../../Type/produtos';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../../../Core/services/cart.service';
import { SnackbarComponent } from '../../../shared/snackbar/snackbar.component';

@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, RouterModule, SnackbarComponent],
  templateUrl: './lista-produtos.component.html',
  styleUrl: './lista-produtos.component.scss'
})
export class ListaProdutosComponent {
  categorias = categorias;
  produtos = produtos;
  produtosKeys = Object.keys(produtos);

  snackbarMessage: string = '';
  showSnackbar: boolean = false;

  constructor(private cartService: CartService) {}

  adicionarAoCarrinho(produto: any) {
    this.cartService.addToCart(produto);
    this.snackbarMessage = 'Produto adicionado ao carrinho';
    this.showSnackbar = true;

    setTimeout(() => {
      this.showSnackbar = false;
    }, 3000);
  }

}
