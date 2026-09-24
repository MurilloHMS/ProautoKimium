import {
  Component, DestroyRef, HostListener,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { PkSheetComponent } from '../../../components/theme/ProautoKimium/pk-sheet/pk-sheet.component';
import {
  CategoriaDaGaveta,
  DestinoDaGaveta,
  categoriasDaGaveta,
  destinosDe,
} from './gaveta.model';

/** Quantos apps o cartão da categoria mostra grandes, antes do aglomerado. */
const NO_CARTAO = 3;

/**
 * A gaveta de apps do celular.
 *
 * <p>Substitui o menu hierárquico abaixo de 768px. Quem escolhe entre ela e a
 * árvore é o shell, com um `@if` — a gaveta <b>não tem media query nenhuma</b>,
 * e é isso que impede o breakpoint de existir num quarto lugar.
 *
 * <p>A forma vem de dois lugares, os dois pedidos por ele: a grade de
 * categorias com os apps mais usados visíveis é a biblioteca do iOS, e a pasta
 * que abre por cima é a MIUI.
 *
 * <p><b>A pasta é montada DENTRO do painel</b>, e isso não é arrumação: o
 * `$z-drawer` é 1100 e a `pk-sheet` é 1050. Irmã, a pasta abriria invisível
 * atrás da gaveta. Funciona porque o painel tem `transform`, que cria bloco
 * contentor e torna o `position: fixed` e o `z-index` da folha locais a ele —
 * então trocar essa animação por `opacity` faz a pasta sumir.
 */
@Component({
  selector: 'app-gaveta',
  standalone: true,
  imports: [RouterLink, PkSheetComponent],
  templateUrl: './gaveta.component.html',
  styleUrl: './gaveta.component.scss',
})
export class GavetaComponent {

  private readonly menuService = inject(MenuService);
  private readonly telasRecentes = inject(TelasRecentesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  /** A categoria cuja pasta está aberta. Nula = a grade. */
  readonly pastaAberta = signal<CategoriaDaGaveta | null>(null);

  /**
   * As categorias, do menu já filtrado por permissão.
   *
   * <p>É `computed` sobre um sinal que muda quando as permissões chegam: elas
   * vêm por HTTP depois do login, e um campo montaria a grade vazia para sempre
   * — foi o defeito que o `nav-drawer` já documenta.
   */
  readonly categorias = computed<CategoriaDaGaveta[]>(() =>
    categoriasDaGaveta(this.menuService.menu()));

  constructor() {
    // Fecha a pasta junto com a gaveta: reabrir dentro de uma pasta que a
    // pessoa fechou sem querer é reabrir no lugar errado.
    effect(() => {
      if (!this.open()) this.pastaAberta.set(null);
    });

    this.destroyRef.onDestroy(() => document.body.classList.remove('drawer-open'));

    effect(() => document.body.classList.toggle('drawer-open', this.open()));
  }

  /**
   * Os apps que aparecem grandes no cartão, por hábito.
   *
   * <p>Hábito e não recência: um cartão que muda de conteúdo a cada navegação
   * não se aprende. A distinção já existe no `TelasRecentesService`, e foi feita
   * de propósito quando o atalho da barra de baixo foi construído.
   *
   * <p>Quem nunca abriu nada cai na ordem do menu, que é a do desktop.
   */
  destaques(categoria: CategoriaDaGaveta): DestinoDaGaveta[] {
    const habito = this.telasRecentes.porHabito();

    const posicao = (destino: DestinoDaGaveta) => {
      const path = destino.routerLink?.join('/');
      const i = path ? habito.findIndex(t => t.path === `/${path}` || t.path === path) : -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };

    return [...destinosDe(categoria)]
      .sort((a, b) => posicao(a) - posicao(b))
      .slice(0, NO_CARTAO);
  }

  /** Quantos sobram fora do cartão — o "+14" do aglomerado. */
  restantes(categoria: CategoriaDaGaveta): number {
    return Math.max(0, categoria.total - NO_CARTAO);
  }

  abrirPasta(categoria: CategoriaDaGaveta): void {
    this.pastaAberta.set(categoria);
  }

  fecharPasta(): void {
    this.pastaAberta.set(null);
  }

  fechar(): void {
    this.closed.emit();
  }

  /** Navegar fecha a gaveta inteira — inclusive a pasta, pelo efeito. */
  aoEscolher(): void {
    this.fechar();
  }

  /**
   * `Esc` fecha uma camada por vez.
   *
   * <p>Sai cedo quando a pasta está aberta: sem isto, o listener da gaveta e o
   * da `pk-sheet` disparam no mesmo evento e fecham as duas de uma vez.
   */
  @HostListener('document:keydown.escape')
  aoEsc(): void {
    if (!this.open() || this.pastaAberta()) return;
    this.fechar();
  }
}
