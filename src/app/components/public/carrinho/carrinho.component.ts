import { Component, OnInit } from '@angular/core';
import { CartService } from '../../../infrastructure/services/cart.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-carrinho',
    imports: [CommonModule],
    templateUrl: './carrinho.component.html',
    styleUrl: './carrinho.component.scss'
})
export class CarrinhoComponent {
  produtos: any[] = [];

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.cartService.getCart().subscribe(produtos => {
      this.produtos = produtos;
    });
  }

  gerarMensagemWhatsapp() {
    if (this.produtos.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }


    let mensagem = 'Olá, gostaria de solicitar um orçamento dos seguintes itens:%0A%0A';
    this.produtos.forEach((produto, index) => {
      mensagem += `    ${index + 1}. ${produto.titulo} - ${produto.descricao} - ${produto.cor} - ${produto.diluicao}%0A`;
    });

    const numeroWhatsApp = '5511983583564';
    const url = `https://api.whatsapp.com/send?phone=${numeroWhatsApp}&text=${mensagem}`;
    window.open(url, '_blank');
  }

  limparCarrinho() {
    this.cartService.clearCart();
  }

  removerProduto(index: number) {
    this.cartService.removeFromCart(index);
  }
}
