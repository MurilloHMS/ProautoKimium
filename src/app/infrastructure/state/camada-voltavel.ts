import { DestroyRef, inject } from '@angular/core';

/**
 * A chave que marca, no `history.state`, uma entrada que é nossa.
 *
 * Exportada porque o teste precisa montar uma entrada marcada à mão.
 */
export const MARCA_DE_CAMADA = 'pkCamadaVoltavel';

export interface CamadaVoltavel {
  /** Empilha uma entrada de histórico para a camada que acabou de abrir. */
  empilhar(): void;

  /**
   * Fecha por vontade da pessoa (o X, o Esc, o toque fora).
   *
   * <p>Havendo entrada nossa, pede o voltar ao navegador e deixa o `popstate`
   * fazer o trabalho — assim o botão de fechar e o voltar do aparelho seguem o
   * mesmo caminho, em vez de dois caminhos que precisam concordar. Sem entrada
   * nossa, chama `aoVoltar` direto.
   */
  voltar(): void;
}

/**
 * Faz o **voltar do aparelho fechar uma camada** em vez de sair da tela.
 *
 * <p>É o que faltava para a gaveta de apps: no Android, o voltar fechava o app
 * ou levava para a tela anterior com a gaveta ainda por cima na volta.
 *
 * <p><b>Por que não query param.</b> Era a proposta original e está errada: o
 * `TelasRecentesService` assina `NavigationEnd` e chama
 * `registrar(urlAfterRedirects)`, e o `findByUrl` corta o `?` antes de casar.
 * Um `?gaveta=rh` navegaria, cairia na mesma tela limpa e somaria <b>+1 em
 * `visitas`</b> a cada abrir e fechar — corrompendo justamente o ranking de
 * hábito que escolhe o quinto atalho da barra de baixo. `pushState` não passa
 * pelo Router, então recentes, abas e breadcrumb não veem nada.
 *
 * <p><b>Uma entrada por camada aberta, e a URL não muda.</b> A entrada existe
 * só para ter o que o voltar consuma.
 *
 * <p><b>A marca órfã.</b> Escolher um destino navega pelo `routerLink`, e o
 * Router empilha a tela nova por cima da nossa entrada — que fica enterrada.
 * Quando o voltar chega nela, o `popstate` traz a marca no `state`, e aí a
 * entrada é engolida com mais um `back()`. Sem isso sobraria um toque de voltar
 * que não faz nada visível. Manter o `routerLink` em vez de navegar na mão é o
 * que preserva o `href`: leitor de tela anuncia link, e o toque longo abre em
 * outra aba.
 *
 * <p>Mesmo molde do `ehCelular()`: função e não serviço, porque precisa do
 * {@link DestroyRef} de quem usa para soltar o listener.
 *
 * ```ts
 * private readonly camada = camadaVoltavel(() => this.fecharUmaCamada());
 * ```
 *
 * <p>Fora do navegador — SSR, ou teste sem `history` — todos os métodos são
 * inertes e `voltar()` fecha direto.
 */
export function camadaVoltavel(aoVoltar: () => void): CamadaVoltavel {
  if (typeof window === 'undefined' || !window.history) {
    return { empilhar: () => {}, voltar: () => aoVoltar() };
  }

  /** A entrada em que estamos agora é uma que nós empilhamos? */
  let nossa = false;

  const aoPopstate = (evento: PopStateEvent): void => {
    const saimosDaNossa = nossa;
    const estado = evento.state as Record<string, unknown> | null;

    // Caímos DENTRO de uma marca nossa: é uma órfã de navegação. Engole.
    if (estado?.[MARCA_DE_CAMADA]) {
      nossa = false;
      window.history.back();
      return;
    }

    nossa = false;
    if (saimosDaNossa) aoVoltar();
  };

  window.addEventListener('popstate', aoPopstate);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('popstate', aoPopstate));

  return {
    empilhar(): void {
      // O estado do Router (o `navigationId`) vai junto: clobrado, o Router se
      // perde na hora de restaurar esta entrada.
      const estado = { ...(window.history.state ?? {}), [MARCA_DE_CAMADA]: true };

      window.history.pushState(estado, '', location.href);
      nossa = true;
    },

    voltar(): void {
      if (!nossa) {
        aoVoltar();
        return;
      }

      window.history.back();
    },
  };
}
