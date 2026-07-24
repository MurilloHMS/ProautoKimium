import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface HrCategoria {
  titulo: string;
  descricao: string;
  icon: string;
  rota?: string;   // quando definida, o card navega; senão, é placeholder
}

@Component({
  selector: 'app-hr-hub',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hr-hub.component.html',
  styleUrl: './hr-hub.component.scss',
})
export class HrHubComponent {
  categorias: HrCategoria[] = [
    { titulo: 'Meus Documentos', descricao: 'Documentos vinculados pelo RH ao seu cadastro',       icon: 'pi pi-id-card', rota: '/documentos/rh/documents' },
    { titulo: 'Atestados',       descricao: 'Envie atestados e acompanhe seu histórico',            icon: 'pi pi-heart', rota: '/documentos/rh/medical-certificates' },
    { titulo: 'Reembolsos',      descricao: 'Solicite reembolsos e acompanhe o status',              icon: 'pi pi-wallet' },
    { titulo: 'Férias',          descricao: 'Solicite férias e acompanhe seu saldo',                 icon: 'pi pi-sun' },
  ];

  constructor(private router: Router) {}

  abrir(cat: HrCategoria): void {
    if (cat.rota) {
      this.router.navigate([cat.rota]);
    }
    // sem rota → ainda não disponível
  }
}
