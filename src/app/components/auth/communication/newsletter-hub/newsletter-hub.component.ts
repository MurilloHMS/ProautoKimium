import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { NewsletterComponent } from '../newsletter/newsletter.component';
import { NewsletterRevisaoComponent } from '../newsletter-revisao/newsletter-revisao.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';

type Ferramenta = 'revisao' | 'envio';

interface ItemFerramenta {
  key: Ferramenta;
  label: string;
  icon: string;
  hint: string;
  /** A tela do catálogo que libera esta aba. */
  screen: string;
}

/**
 * Newsletter: montar e enviar, no mesmo lugar.
 *
 * Eram duas telas no menu, e as duas fazem parte do mesmo trabalho mensal —
 * conferir os números e disparar. Separadas, a segunda parecia outra coisa, e
 * quem entrava pela primeira não achava a revisão.
 *
 * Mesma casca do hub de holerites: menu parado à esquerda, ferramenta à
 * direita, e no celular o menu vira a tira horizontal.
 */
@Component({
  selector: 'app-newsletter-hub',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, NewsletterComponent, NewsletterRevisaoComponent],
  templateUrl: './newsletter-hub.component.html',
  styleUrl: './newsletter-hub.component.scss',
})
export class NewsletterHubComponent {

  private readonly permissions = inject(PermissionStore);

  private readonly todas: ItemFerramenta[] = [
    {
      key: 'revisao',
      label: 'Revisão do mês',
      icon: 'pi pi-verified',
      hint: 'Busca no Sankhya e confere antes de liberar',
      screen: 'communication/newsletter-revisao',
    },
    {
      key: 'envio',
      label: 'Envio',
      icon: 'pi pi-send',
      hint: 'A fila pronta e o disparo',
      screen: 'communication/newsletter',
    },
  ];

  /**
   * Só o que a pessoa consegue abrir — o mesmo `canOpen` dos hubs de Documentos
   * e Calculadoras.
   *
   * A revisão tem tela própria no catálogo mesmo sem rota: é ela que separa
   * quem confere os números de quem dispara e-mail para a base inteira.
   */
  readonly ferramentas = computed(() =>
    this.todas.filter(f => this.permissions.canOpen(f.screen)));

  /**
   * Abre na revisão, que é por onde o mês começa — mas cai na primeira
   * disponível quando a pessoa não tem acesso a ela.
   */
  readonly ativa = signal<Ferramenta>('revisao');

  constructor() {
    const disponiveis = this.ferramentas();
    if (disponiveis.length && !disponiveis.some(f => f.key === this.ativa())) {
      this.ativa.set(disponiveis[0].key);
    }
  }

  selecionar(key: Ferramenta): void {
    this.ativa.set(key);
  }
}
