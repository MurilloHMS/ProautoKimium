import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface CategoriaDoc {
  titulo: string;
  descricao: string;
  icon: string;
  rota?: string;
  emDesenvolvimento?: boolean;
}

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documentos.component.html',
  styleUrl: './documentos.component.scss',
})
export class DocumentosComponent {
  categorias: CategoriaDoc[] = [
    { titulo: 'Apresentações', descricao: 'Materiais institucionais e de vendas',   icon: 'pi pi-desktop',    emDesenvolvimento: true },
    { titulo: 'Logos',         descricao: 'Identidade visual e arquivos da marca',   icon: 'pi pi-palette',    rota: '/documentos/logos' },
    { titulo: 'Holerites',     descricao: 'Seus demonstrativos de pagamento',        icon: 'pi pi-receipt',    rota: '/documentos/holerites' },
    { titulo: 'Pessoal',       descricao: 'Documentos de RH e pessoais',             icon: 'pi pi-id-card',    emDesenvolvimento: true },
    { titulo: 'Propostas',     descricao: 'Modelos e propostas comerciais',          icon: 'pi pi-file-edit',  emDesenvolvimento: true },
  ];

  constructor(private router: Router) {}

  abrir(cat: CategoriaDoc): void {
    if (cat.emDesenvolvimento) return;
    if (cat.rota) {
      this.router.navigate([cat.rota]);
    }
  }
}
