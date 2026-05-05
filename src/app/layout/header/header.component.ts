import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule, DialogModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  quantidadeProdutos = 0;
  menuAberto = false;
  visible = false;

  constructor() {}

  toggleMenu() {
    this.menuAberto = !this.menuAberto;
  }

  fecharMenuMobile() {
    this.menuAberto = false;
  }
}
