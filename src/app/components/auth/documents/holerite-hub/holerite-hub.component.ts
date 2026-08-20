import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { HoleriteEnvioComponent } from '../holerite-envio/holerite-envio.component';
import { HoleritSpliterComponent } from '../holerit-spliter/holerit-spliter.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

type Ferramenta = 'envio' | 'separar';

interface ItemFerramenta {
  key: Ferramenta;
  label: string;
  icon: string;
  hint: string;
}

/**
 * Casca das ferramentas de holerite: menu à esquerda, ferramenta à direita.
 *
 * Antes era uma página só, empilhada, com as ações depois da lista de páginas —
 * com 200 páginas, enviar exigia rolar tudo. Aqui o menu fica parado e só o
 * conteúdo rola.
 *
 * O padrão vem do `.org-switcher` de `rh/organizational-structure`, que faz a
 * mesma troca por `@switch`, só que com abas horizontais. Abaixo de `$bp-md`
 * este menu vira exatamente aquilo — a mesma tira horizontal, sem componente
 * separado.
 */
@Component({
  selector: 'app-holerite-hub',
  standalone: true,
  imports: [CommonModule, ToastModule, PageHeaderComponent,
            HoleriteEnvioComponent, HoleritSpliterComponent],
  templateUrl: './holerite-hub.component.html',
  styleUrl: './holerite-hub.component.scss',
  providers: [MessageService],
})
export class HoleriteHubComponent {

  readonly ativa = signal<Ferramenta>('envio');

  readonly ferramentas: ItemFerramenta[] = [
    {
      key: 'envio',
      label: 'Enviar holerites',
      icon: 'pi pi-send',
      hint: 'Confere e publica para os funcionários',
    },
    {
      key: 'separar',
      label: 'Separar em PDFs',
      icon: 'pi pi-clone',
      hint: 'Fatia o arquivo e baixa um ZIP, sem vincular',
    },
  ];

  selecionar(key: Ferramenta): void {
    this.ativa.set(key);
  }
}
