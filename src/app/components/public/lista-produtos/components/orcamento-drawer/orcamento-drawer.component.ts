import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrcamentoService } from '../../../../../infrastructure/services/company/products/website/orcamento/orcamento.service';
import { ProductWebSitePublicResponseDTO } from '../../../../../domain/models/products.model';
import { urlDeMidia } from '../../../../../infrastructure/config/media-url';

@Component({
  selector: 'app-orcamento-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orcamento-drawer.component.html',
  styleUrl: './orcamento-drawer.component.scss',
})
export class OrcamentoDrawerComponent {

  orcamento = inject(OrcamentoService);

  drawerAberto = this.orcamento.drawerAberto;

  toggleDrawer(): void {
    this.orcamento.drawerAberto.update(v => !v);
  }

  fecharDrawer(): void {
    this.orcamento.fecharDrawer();
  }

  // Abre o modal de envio (gerenciado pelo service / renderizado no lista-produtos).
  abrirModal(): void {
    this.orcamento.abrirModal();
  }

  resolverImagem(produto: ProductWebSitePublicResponseDTO): string {
    return urlDeMidia(produto.imagem);
  }
}
