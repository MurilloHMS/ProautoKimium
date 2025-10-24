import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface Color {
  hex: string;
  name: string;
  reason?: string;
}

@Component({
  selector: 'app-branding',
  imports: [CommonModule],
  templateUrl: './branding.component.html',
  styleUrl: './branding.component.scss'
})
export class BrandingComponent {
  mainColors: Color[] = [
    { hex: '#232e61', name: 'Azul Principal' },
    { hex: '#3e4b85', name: 'Azul Médio' },
    { hex: '#5c6694', name: 'Azul Claro' },
    { hex: '#1b224d', name: 'Azul Escuro' },
    { hex: '#57c1ab', name: 'Verde Principal' },
    { hex: '#a4ddd2', name: 'Verde Claro' },
    { hex: '#3e9e8e', name: 'Verde Escuro' },
    { hex: '#85bfb5', name: 'Verde Médio' },
    { hex: '#f5f2f7', name: 'Neutro Claro' },
    { hex: '#e8e8ea', name: 'Neutro' }
  ];

  supportColors: Color[] = [
    { hex: '#f28b82', name: 'Coral' },
    { hex: '#fddc69', name: 'Amarelo' },
    { hex: '#b5e2b1', name: 'Verde Pastel' },
    { hex: '#fbbd9d', name: 'Pêssego' },
    { hex: '#8a9a91', name: 'Verde Cinza' },
    { hex: '#4a5568', name: 'Cinza Escuro' },
    { hex: '#dcd9f3', name: 'Lavanda' },
    { hex: '#609ca4', name: 'Azul Petróleo' },
    { hex: '#b7a89d', name: 'Bege' }
  ];

  avoidColors: Color[] = [
    { hex: '#000000', name: 'Preto', reason: 'Pesado demais' },
    { hex: '#ff0000', name: 'Vermelho', reason: 'Remete a erro' },
    { hex: '#ffff00', name: 'Amarelo Puro', reason: 'Visualmente instável' },
    { hex: '#ffa500', name: 'Laranja', reason: 'Quebra sobriedade' },
    { hex: '#8000ff', name: 'Roxo', reason: 'Compete com o azul' }
  ];
}
