import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface CategoriaDoc {
  titulo: string;
  descricao: string;
  icon: string;
  accent: string;
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
    { titulo: 'Galeria',       descricao: 'Fotos, logos e catálogos da empresa',    icon: 'pi pi-images',     accent: '#7c5cbf', rota: '/documentos/galeria' },
    { titulo: 'Logos',         descricao: 'Identidade visual e arquivos da marca',   icon: 'pi pi-palette',    accent: '#e07b4c', rota: '/documentos/logos' },
    { titulo: 'Holerites',     descricao: 'Seus demonstrativos de pagamento',        icon: 'pi pi-receipt',    accent: '#d92d20', rota: '/documentos/holerites' },
    { titulo: 'Pessoal',       descricao: 'Documentos de RH e pessoais',             icon: 'pi pi-id-card',    accent: '#232e61', emDesenvolvimento: true },
    { titulo: 'Propostas',     descricao: 'Modelos e propostas comerciais',          icon: 'pi pi-file-edit',  accent: '#3e9e8e', emDesenvolvimento: true },
    { titulo: 'Checklist',     descricao: 'Formulários e checklists',              icon: 'pi pi-list',       accent: '#f5a623', emDesenvolvimento: true }
  ];

  constructor(private router: Router) {}

  abrir(cat: CategoriaDoc): void {
    if (cat.emDesenvolvimento) return;
    if (cat.rota) {
      this.router.navigate([cat.rota]);
    }
  }
}
