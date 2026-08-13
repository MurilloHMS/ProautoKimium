import { Component, HostListener, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {

  private readonly router = inject(Router);

  menuAberto = false;

  /** Aba ativa do bottom nav (controla o indicador líquido). 0..3 = destinos. */
  activeIndex = 0;

  /** Rolou além do topo → barra superior encolhe (vidro mais denso). */
  scrolled = false;

  /** Rolando para baixo → bottom nav condensa (esconde rótulos). */
  navCondensed = false;

  private lastY = 0;
  private readonly scrollHandler = (e: Event) => this.handleScroll(e);

  ngOnInit() {
    // Captura a rolagem tanto da janela quanto de containers internos
    // (scroll não borbulha, mas a fase de captura alcança qualquer scroller).
    window.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.scrollHandler, { capture: true } as any);
  }

  setActive(i: number) {
    this.activeIndex = i;
  }

  /**
   * Rolagem suave até a seção, sem passar pelo hash do navegador.
   *
   * O `href="#secao"` nativo muda a URL por fora do roteador: a partir daí o
   * Angular acha que está numa URL e o navegador está em outra, e a próxima
   * navegação por `routerLink` é descartada em silêncio. Era o motivo de um
   * link do cabeçalho parar de funcionar depois do primeiro clique.
   *
   * O `href` continua no template para o link poder ser copiado e aberto em
   * outra aba; aqui ele é interceptado.
   */
  irParaSecao(id: string, event: Event) {
    event.preventDefault();
    this.fecharMenuMobile();

    const alvo = document.getElementById(id);

    // Fora da home não há a seção: o roteador leva até lá e o
    // `anchorScrolling` do app.config posiciona na chegada.
    if (!alvo) {
      this.router.navigate(['/'], { fragment: id });
      return;
    }

    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // replaceState em vez de mexer no hash: registra onde o usuário está sem
    // disparar navegação nenhuma.
    history.replaceState(null, '', `#${id}`);

    this.reanimarNaChegada(alvo);
  }

  /**
   * Reexecuta o `appReveal` da seção quando a rolagem termina.
   *
   * A diretiva anima o bloco ao entrar na viewport e para de observar depois.
   * Rolando suave, a página cruza as seções do caminho e todas animam durante
   * o trajeto — na chegada, o destino já apareceu e o efeito se perde. Aqui a
   * animação é rebobinada e tocada de novo, no momento em que a pessoa está
   * olhando.
   */
  private reanimarNaChegada(alvo: HTMLElement) {
    const alvos = [alvo, ...Array.from(alvo.querySelectorAll<HTMLElement>('.reveal'))]
      .filter(node => node.classList.contains('reveal'));

    if (alvos.length === 0) return;

    const tocar = () => {
      for (const node of alvos) {
        node.classList.remove('is-visible');
        void node.offsetWidth;          // força reflow: sem isto o navegador
        node.classList.add('is-visible'); // agrupa as duas mudanças e nada anima
      }
    };

    // `scrollend` ainda não existe no Safari, então o tempo é a rede de
    // segurança — e o `once` garante que só um dos dois toque.
    let tocado = false;
    const umaVez = () => {
      if (tocado) return;
      tocado = true;
      tocar();
    };

    document.addEventListener('scrollend', umaVez, { once: true });
    setTimeout(umaVez, 700);
  }

  toggleMenu() {
    this.menuAberto = !this.menuAberto;
    this.atualizarScrollLock();
  }

  fecharMenuMobile() {
    if (!this.menuAberto) return;
    this.menuAberto = false;
    this.atualizarScrollLock();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.fecharMenuMobile();
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth >= 1024 && this.menuAberto) {
      this.fecharMenuMobile();
    }
  }

  /** Redimensionamento das barras de vidro conforme a rolagem. */
  private handleScroll(e: Event) {
    const target = e.target as (HTMLElement | Document | null);
    let y = window.scrollY || document.documentElement.scrollTop || 0;
    if (target && target !== document && (target as HTMLElement).scrollTop != null) {
      y = (target as HTMLElement).scrollTop || y;
    }

    this.scrolled = y > 8;

    if (y > this.lastY + 4 && y > 64) {
      this.navCondensed = true;          // descendo → condensa
    } else if (y < this.lastY - 4 || y < 64) {
      this.navCondensed = false;         // subindo ou perto do topo → expande
    }
    this.lastY = y;
  }

  private atualizarScrollLock() {
    document.body.style.overflow = this.menuAberto ? 'hidden' : '';
  }
}
