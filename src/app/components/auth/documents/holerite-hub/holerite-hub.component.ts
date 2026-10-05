import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { HoleriteAuditoriaComponent } from '../holerite-auditoria/holerite-auditoria.component';
import { HoleriteEnvioComponent } from '../holerite-envio/holerite-envio.component';
import { HoleritSpliterComponent } from '../holerit-spliter/holerit-spliter.component';
import { HoleritExtractorComponent } from '../holerit-extractor/holerit-extractor.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

type Ferramenta = 'envio' | 'auditoria' | 'separar' | 'coletar';

interface ItemFerramenta {
  key: Ferramenta;
  label: string;
  icon: string;
  hint: string;
  /** A tela que a ferramenta exige, quando não é a do próprio hub. */
  screen?: string;
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
            HoleriteEnvioComponent, HoleriteAuditoriaComponent, HoleritSpliterComponent, HoleritExtractorComponent],
  templateUrl: './holerite-hub.component.html',
  styleUrl: './holerite-hub.component.scss',
  providers: [MessageService],
})
export class HoleriteHubComponent {

  private readonly permissions = inject(PermissionStore);

  readonly ativa = signal<Ferramenta>('envio');

  /**
   * O Coletar era item de menu à parte (2026-10-05: entrou aqui, na
   * reorganização do RH). Continua com a tela dele na grade: só aparece para
   * quem já abria `rh/holerit/extractor`.
   */
  private readonly todas: ItemFerramenta[] = [
    {
      key: 'envio',
      label: 'Enviar holerites',
      icon: 'pi pi-send',
      hint: 'Confere e publica para os funcionários',
    },
    {
      key: 'auditoria',
      label: 'Auditoria',
      icon: 'pi pi-verified',
      hint: 'Quem recebeu, abriu e confirmou',
    },
    {
      key: 'separar',
      label: 'Separar em PDFs',
      icon: 'pi pi-clone',
      hint: 'Fatia o arquivo e baixa um ZIP, sem vincular',
    },
    {
      key: 'coletar',
      label: 'Coletar holerites',
      icon: 'pi pi-file-arrow-up',
      hint: 'Extrai os dados da folha do PDF para conferir',
      screen: 'rh/holerit/extractor',
    },
  ];

  readonly ferramentas = computed(() =>
    this.todas.filter(f => !f.screen || this.permissions.canOpen(f.screen)));

  selecionar(key: Ferramenta): void {
    this.ativa.set(key);
  }
}
