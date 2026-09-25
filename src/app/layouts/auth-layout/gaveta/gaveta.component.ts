import {
  Component, DestroyRef, ElementRef, HostListener, Injector,
  afterNextRender, computed, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { PkSheetComponent } from '../../../components/theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { camadaVoltavel } from '../../../infrastructure/state/camada-voltavel';
import {
  CategoriaDaGaveta,
  DestinoDaGaveta,
  ResultadoDaBusca,
  categoriasDaGaveta,
  comoResultado,
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
  imports: [RouterLink, NgTemplateOutlet, PkSheetComponent],
  templateUrl: './gaveta.component.html',
  styleUrl: './gaveta.component.scss',
})
export class GavetaComponent {

  private readonly menuService = inject(MenuService);
  private readonly telasRecentes = inject(TelasRecentesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  private readonly lupa = viewChild<ElementRef<HTMLButtonElement>>('lupa');

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  /** A categoria cuja pasta está aberta. Nula = a grade. */
  readonly pastaAberta = signal<CategoriaDaGaveta | null>(null);

  /**
   * O campo aberto por cima da linha do título. Aberto e vazio ainda mostra a
   * grade: quem tocou a lupa e desistiu não deveria ficar olhando uma tela
   * em branco.
   */
  readonly buscaAberta = signal(false);

  /** O que está no campo de busca. Com texto, a grade sai e a lista entra. */
  readonly busca = signal('');

  readonly buscando = computed(() => this.busca().trim().length > 0);

  /**
   * A busca é a da topbar, e não uma segunda: o `MenuService.search` já dobra
   * acento e já só enxerga o que a pessoa pode abrir. Tela sem permissão não
   * aparece aqui pela mesma razão que não aparece na grade.
   */
  readonly resultados = computed<ResultadoDaBusca[]>(() => {
    const busca = this.busca();
    return this.menuService.search(busca).map(item => comoResultado(item, busca));
  });

  /**
   * O que o leitor de tela ouve a cada letra. Mora numa região que existe
   * sempre: uma região `aria-live` criada junto com o conteúdo não anuncia.
   */
  readonly anuncio = computed(() => {
    if (!this.buscando()) return '';
    const total = this.resultados().length;
    if (total === 0) return 'Nenhuma tela encontrada';
    return total === 1 ? '1 tela encontrada' : `${total} telas encontradas`;
  });

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
    // A busca vai junto pelo mesmo motivo: reabrir a gaveta numa lista
    // filtrada esconde a grade de quem veio procurar outra coisa.
    effect(() => {
      if (!this.open()) {
        this.pastaAberta.set(null);
        this.buscaAberta.set(false);
        this.busca.set('');
      }
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

  /**
   * O foco vai para o campo AQUI, dentro do toque, e não num efeito depois:
   * no Safari do iPhone o teclado só sobe se o foco acontecer no próprio
   * gesto. Um `setTimeout` abriria o campo com o teclado fechado.
   *
   * <p>A busca não empilha entrada no histórico, como a pasta não empilha: o
   * voltar do aparelho a fecha pelo {@link fecharUmaCamada}, que repõe a da
   * gaveta.
   */
  abrirBusca(campo: HTMLInputElement): void {
    this.buscaAberta.set(true);
    campo.focus();
  }

  /**
   * Fecha o campo e esquece o texto. O foco volta para a lupa, de onde veio.
   *
   * <p>Depois do próximo render, e não já: até lá a lupa ainda está `inert`,
   * e o navegador recusa o foco calado — ele ficaria no campo que acabou de
   * sumir. É o oposto do `abrirBusca`, e pode ser: devolver foco a um botão
   * não depende do gesto.
   */
  cancelarBusca(lupa?: HTMLElement): void {
    this.buscaAberta.set(false);
    this.busca.set('');
    if (lupa) afterNextRender(() => lupa.focus(), { injector: this.injector });
  }

  limparBusca(campo: HTMLInputElement): void {
    this.busca.set('');
    // O botão some junto com o texto; sem devolver o foco ao campo, ele cairia
    // no corpo da página, atrás da gaveta.
    campo.focus();
  }

  /**
   * Enter abre o primeiro resultado — a tecla do teclado do celular diz
   * "Buscar", e quem a toca espera ir a algum lugar.
   *
   * <p>Pelo `path` e não pelo `routerLink`: o array é relativo a quem o
   * declara, e aqui não há rota nenhuma para ele ser relativo.
   */
  aoEnter(evento: Event): void {
    evento.preventDefault();

    const primeiro = this.resultados()[0];
    if (!primeiro) return;

    if (primeiro.externo) {
      window.open(primeiro.url, primeiro.target ?? '_blank', 'noopener');
    } else {
      this.router.navigateByUrl(primeiro.path);
    }

    this.aoEscolher();
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

    if (this.buscaAberta()) {
      this.cancelarBusca();
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
   *
   * <p>A busca conta como camada: o `Esc` fecha o campo e devolve a grade, e
   * só o seguinte fecha a gaveta.
   */
  @HostListener('document:keydown.escape')
  aoEsc(): void {
    if (!this.open() || this.pastaAberta()) return;

    if (this.buscaAberta()) {
      this.cancelarBusca(this.lupa()?.nativeElement);
      return;
    }

    this.fechar();
  }
}
