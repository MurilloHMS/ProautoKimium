import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../infrastructure/services/auth.service';
import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { AppMenuItem } from '../menu.config';

/**
 * Nó da árvore renderizada pelo drawer.
 *
 * O `id` (caminho desde a raiz) existe porque rótulos se repetem — há
 * "Comunicação" no primeiro nível e outra dentro de RH. Controlar expansão por
 * rótulo abriria as duas juntas.
 */
interface DrawerNode {
  id: string;
  label: string;
  icon: string;
  routerLink?: string[];
  url?: string;
  target?: string;
  path: string;
  children: DrawerNode[];
}

@Component({
  selector: 'app-nav-drawer',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  templateUrl: './nav-drawer.component.html',
  styleUrl: './nav-drawer.component.scss',
})
export class NavDrawerComponent {

  open = input<boolean>(false);
  closed = output<void>();

  private readonly router = inject(Router);
  private readonly menuService = inject(MenuService);
  private readonly destroyRef = inject(DestroyRef);

  readonly auth = inject(AuthService);

  /**
   * `computed` e não campo: as permissões chegam por HTTP **depois** do login.
   *
   * Isto era um campo, com o comentário "papéis não mudam sem recarregar a
   * página, então basta montar uma vez" — verdade com roles, que vêm no token.
   * Com permissão vindo de requisição, o menu montava vazio e nunca mais
   * recalculava.
   */
  readonly nodes = computed<DrawerNode[]>(() => this.toNodes(this.menuService.menu()));

  readonly expanded = signal<ReadonlySet<string>>(new Set<string>());

  private readonly telasRecentes = inject(TelasRecentesService);

  /** O que foi digitado na busca do menu. */
  readonly termo = signal('');

  readonly buscando = computed(() => this.termo().trim().length > 0);

  /** Reusa a busca do MenuService, que já dobra acento e casa o caminho. */
  readonly resultados = computed(() => this.menuService.search(this.termo()));

  readonly recentes = this.telasRecentes.recentes;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly campoBusca = viewChild<ElementRef<HTMLInputElement>>('campoBusca');
  private everOpened = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();

      document.body.classList.toggle('drawer-open', isOpen);

      if (isOpen) {
        this.everOpened = true;
        this.expandActiveBranch();
        queueMicrotask(() => this.focusFirst());
        return;
      }

      // Só devolve o foco se o drawer chegou a abrir — senão roubaria o foco no load.
      if (this.everOpened) {
        document.getElementById('app-menu-button')?.focus();
      }
    });

    this.destroyRef.onDestroy(() => document.body.classList.remove('drawer-open'));
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  /** Accordion: abrir um irmão fecha os demais do mesmo nível. */
  toggle(node: DrawerNode, siblings: DrawerNode[]): void {
    const next = new Set(this.expanded());
    const wasExpanded = next.has(node.id);

    siblings.forEach(sibling => next.delete(sibling.id));
    if (!wasExpanded) next.add(node.id);

    this.expanded.set(next);
  }

  close(): void {
    // A busca não sobrevive ao fechamento: reabrir o menu com o termo antigo
    // mostraria resultados de uma procura que a pessoa já terminou.
    this.limparBusca();
    this.closed.emit();
  }

  aoDigitar(evento: Event): void {
    this.termo.set((evento.target as HTMLInputElement).value);
  }

  limparBusca(): void {
    this.termo.set('');
  }

  /**
   * Vai para um destino de busca ou de recentes. Aceita os dois formatos
   * porque ambos carregam `path`; o `url` só existe nos externos, que vêm
   * apenas da busca.
   */
  irPara(item: { path: string; url?: string; target?: string }): void {
    if (item.url) {
      window.open(item.url, item.target ?? '_self');
    } else {
      this.router.navigateByUrl(item.path);
    }

    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  /** Mantém o Tab preso dentro do painel enquanto ele está aberto. */
  @HostListener('document:keydown.tab', ['$event'])
  onTab(event: KeyboardEvent): void {
    if (!this.open()) return;

    const focusables = this.focusableElements();
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !this.panel()?.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Em telas grandes o drawer não deve ficar aberto sobre o conteúdo. */
  @HostListener('window:resize')
  onResize(): void {
    if (this.open() && window.innerWidth >= 1400) this.close();
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  private focusableElements(): HTMLElement[] {
    const root = this.panel()?.nativeElement;
    if (!root) return [];

    return Array.from(
      root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    ).filter(el => el.offsetParent !== null);
  }

  /**
   * Foca a busca quando ela está visível — no celular ela é o primeiro
   * elemento, e era o botão de fechar que recebia o foco por ser o primeiro no
   * DOM. Foco programático não levanta o teclado do iOS, então a lista de
   * recentes continua à vista.
   */
  private focusFirst(): void {
    const campo = this.campoBusca()?.nativeElement;
    if (campo && campo.offsetParent !== null) {
      campo.focus();
      return;
    }

    this.focusableElements()[0]?.focus();
  }

  /** Ao abrir, já deixa aberto o caminho até a página atual. */
  private expandActiveBranch(): void {
    const url = this.router.url.split('?')[0];
    const branch = new Set<string>();

    const walk = (nodes: DrawerNode[], ancestors: string[]): boolean => {
      for (const node of nodes) {
        const isMatch = !!node.path && (url === node.path || url.startsWith(`${node.path}/`));
        const childMatched = walk(node.children, [...ancestors, node.id]);

        if (isMatch || childMatched) {
          ancestors.forEach(id => branch.add(id));
          if (childMatched) branch.add(node.id);
          return true;
        }
      }
      return false;
    };

    walk(this.nodes(), []);
    this.expanded.set(branch);
  }

  private toNodes(items: AppMenuItem[], parentId = ''): DrawerNode[] {
    return items.map(item => {
      const id = parentId ? `${parentId}/${item.label}` : item.label;

      return {
        id,
        label: item.label,
        icon: item.icon,
        routerLink: item.routerLink,
        url: item.url,
        target: item.target,
        path: item.routerLink ? `/${item.routerLink.join('/')}` : '',
        children: item.items ? this.toNodes(item.items, id) : [],
      };
    });
  }
}
