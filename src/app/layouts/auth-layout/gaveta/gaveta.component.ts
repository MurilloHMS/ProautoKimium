import {
  Component, DestroyRef, HostListener,
  computed, effect, inject, input, output, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { PkSheetComponent } from '../../../components/theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { camadaVoltavel } from '../../../infrastructure/state/camada-voltavel';
import {
  CategoriaDaGaveta,
  DestinoDaGaveta,
  categoriasDaGaveta,
  destinosDe,
} from './gaveta.model';

/**
 * O cartão é uma grade 2x2 — quatro células, e nunca um buraco.
 *
 * Até quatro destinos, os quatro aparecem e nao existe "ver mais": abrir uma
 * pasta para ver o que ja esta na tela nao leva a lugar nenhum. Acima de
 * quatro, entram tres e a quarta celula vira o "ver mais".
 */
const CABEM_NO_CARTAO = 4;
const COM_VER_MAIS = 3;

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
 * <p><b>O voltar do aparelho fecha uma camada por vez</b>, pelo
 * {@link camadaVoltavel}: primeiro a pasta, depois a gaveta. Sem isso o voltar
 * do Android saía da tela com a gaveta ainda por cima — que é como ela estava
 * até agora.
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
   * O voltar do aparelho, e também o X e o Esc: todos passam por aqui.
   *
   * <p>Ter um caminho só é o ponto. Fechar pelo X sem consumir a entrada do
   * histórico deixaria um toque de voltar que não faz nada; fechar por dois
   * caminhos diferentes deixaria dois comportamentos que precisam concordar.
   */
  private readonly camada = camadaVoltavel(() => this.fecharUmaCamada());

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

    // Uma entrada por abertura. A pasta NÃO empilha outra: ela reaproveita
    // esta, e quem a repõe é o `fecharUmaCamada`.
    effect(() => {
      if (this.open()) this.camada.empilhar();
    });
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
    const quantos = this.temVerMais(categoria) ? COM_VER_MAIS : CABEM_NO_CARTAO;

    const posicao = (destino: DestinoDaGaveta) => {
      const path = destino.routerLink?.join('/');
      const i = path ? habito.findIndex(t => t.path === `/${path}` || t.path === path) : -1;
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };

    return [...destinosDe(categoria)]
      .sort((a, b) => posicao(a) - posicao(b))
      .slice(0, quantos);
  }

  /** A quarta célula vira "ver mais" só quando há o que a pasta mostre a mais. */
  temVerMais(categoria: CategoriaDaGaveta): boolean {
    return categoria.total > CABEM_NO_CARTAO;
  }

  /** Quantos ficam de fora do cartão — o "+13" da quarta célula. */
  restantes(categoria: CategoriaDaGaveta): number {
    return Math.max(0, categoria.total - COM_VER_MAIS);
  }

  abrirPasta(categoria: CategoriaDaGaveta): void {
    this.pastaAberta.set(categoria);
  }

  fecharPasta(): void {
    this.camada.voltar();
  }

  fechar(): void {
    this.camada.voltar();
  }

  /**
   * Navegar fecha a gaveta inteira — inclusive a pasta, pelo efeito.
   *
   * <p>Não pede o voltar: o `routerLink` já navegou, e um `back()` aqui
   * desfaria a navegação que a pessoa acabou de pedir. A entrada fica
   * enterrada, e o helper a engole quando o voltar chegar nela.
   */
  aoEscolher(): void {
    this.closed.emit();
  }

  /**
   * Fecha a camada de cima. É o que o voltar do aparelho faz, e no que o X e o
   * Esc desembocam.
   *
   * <p>Havendo pasta, ela fecha e a entrada é **reposta** — senão o próximo
   * voltar sairia da tela em vez de fechar a gaveta.
   */
  private fecharUmaCamada(): void {
    if (this.pastaAberta()) {
      this.pastaAberta.set(null);
      this.camada.empilhar();
      return;
    }

    this.closed.emit();
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
