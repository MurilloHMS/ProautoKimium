import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrcamentoService } from '../../../../../infrastructure/services/company/products/website/orcamento/orcamento.service';
import { environment } from '../../../../../../environments/environment';
import { ProductWebSitePublicResponseDTO } from '../../../../../domain/models/products.model';

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
    if (!produto.imagem) {
      return 'images/products/placeholder.png';
    }
    if (produto.imagem.startsWith('http')) {
      return produto.imagem;
    }
    const origem = new URL(environment.apiUrl).origin;
    const caminho = produto.imagem.startsWith('/') ? produto.imagem : `/${produto.imagem}`;
    return `${origem}${caminho}`;
  }
}
