import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../infrastructure/services/cart.service';
import { DialogModule } from 'primeng/dialog';
import { ContactComponent } from '../../shared/contact/contact.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule, DialogModule, ContactComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  quantidadeProdutos = 0;
  menuAberto = false;
  visible = false;

  constructor(private cartService: CartService) {}

  ngOnInit() {
    this.cartService.getCartCount().subscribe(count => {
      this.quantidadeProdutos = count;
    });
  }

  toggleMenu() {
    this.menuAberto = !this.menuAberto;
  }

  fecharMenuMobile() {
    this.menuAberto = false;
  }
}
