import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { MenuService } from '../../../infrastructure/services/menu.service';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';

/** Um atalho da barra, já resolvido para desenho. */
interface ItemDaBarra {
  label: string;
  icon: string;
  routerLink: string[];
  path: string;
  /** Só a Início casa exato; ela é prefixo de nada e capturaria tudo. */
  exato: boolean;
  /** Se este item acende o ponto de não lidas. */
  contador: boolean;
}

/**
 * A barra de baixo do celular.
 *
 * **O estado ativo é calculado aqui, e não pelo `routerLinkActive`.** A versão
 * anterior usava `{ exact: true }`, então em `/documentos/123` **nenhum** item
 * ficava marcado — passava despercebido porque a única marca era uma cor. Com
 * a pílula correndo, um indicador apontando para lugar nenhum fica gritante,
 * então o casamento passou a ser por prefixo.
 *
 * **A pílula não mede o DOM.** A barra é uma grade de colunas iguais, então a
 * posição do item ativo é `índice / total` — pura aritmética de CSS. Medir com
 * `offsetLeft` daria o mesmo número ao custo de um `ViewChildren`, um listener
 * de `resize` e um reflow por navegação.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {

  private readonly menuService = inject(MenuService);
  private readonly telasRecentes = inject(TelasRecentesService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  /** Alimenta o ponto: é signal, e o STOMP o atualiza ao vivo. */
  readonly naoLidas = this.notifications.unreadCount;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map(evento => evento.urlAfterRedirects)),
    { initialValue: this.router.url });

  /**
   * Os atalhos fixos mais o de hábito. O quinto entra só quando a pessoa já
   * tem histórico e ele não repete um dos fixos — barra com item repetido
   * desperdiça o espaço mais valioso da tela.
   */
  readonly items = computed<ItemDaBarra[]>(() => {
    const fixos = this.menuService.mobileItems().map(item => this.paraItem(
      item.label,
      item.icon,
      item.routerLink ?? [],
      item.routerLink?.[0] === 'notificacoes'));

    const habito = this.telasRecentes.maisUsada();
    if (!habito) return fixos;

    const jaEstaNaBarra = fixos.some(fixo => fixo.path === habito.path);
    if (jaEstaNaBarra) return fixos;

    return [...fixos, this.paraItem(
      habito.label,
      habito.icon,
      habito.path.replace(/^\//, '').split('/'),
      false)];
  });

  /** `-1` quando a tela atual não é nenhum dos atalhos: a pílula some. */
  readonly indiceAtivo = computed(() => {
    const atual = this.url().split(/[?#]/)[0].replace(/\/+$/, '');

    return this.items().findIndex(item => item.exato
      ? atual === item.path
      : atual === item.path || atual.startsWith(`${item.path}/`));
  });

  private paraItem(
    label: string,
    icon: string,
    routerLink: string[],
    contador: boolean,
  ): ItemDaBarra {
    const path = `/${routerLink.join('/')}`.replace(/\/+/g, '/');
    return { label, icon, routerLink, path, exato: path === '/home', contador };
  }
}
