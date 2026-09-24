import { DestroyRef, Signal, inject, signal } from '@angular/core';

/**
 * A largura em que a tela deixa de ser desktop.
 *
 * **Este número existe duas vezes: aqui e no `$bp-md` do SCSS.** A fronteira
 * atravessa do CSS para o TypeScript, e se um mudar sem o outro a tabela e os
 * cartões aparecem ao mesmo tempo — ou nenhum dos dois.
 */
export const LARGURA_DE_CELULAR = '(max-width: 768px)';

/**
 * Um sinal que diz se a tela é de celular, e se mantém ao girar o aparelho.
 *
 * <p><b>Por que é uma função e não um serviço:</b> ela precisa de
 * {@link DestroyRef} para soltar o listener, e chamar de dentro do componente
 * amarra o ciclo de vida ao de quem usa. Um serviço em `root` viveria para
 * sempre, o que é certo para o listener e errado para quem quiser testar uma
 * tela isolada.
 *
 * <p>Estava copiado em cinco componentes — Programação, Eventos, Conciliação,
 * CMV, Newsletter. Cópia número seis era hora de parar.
 *
 * ```ts
 * readonly ehCelular = ehCelular();
 * ```
 *
 * <p><b>Não reusar o `TabHandleStore.enabled` no lugar disto.</b> Aquilo
 * significa "as abas estão ligadas", e usá-lo aqui faria os cartões aparecerem
 * no desktop no dia em que alguém desligasse as abas.
 *
 * <p>Fora do navegador — SSR, ou um teste sem `matchMedia` — devolve
 * {@code false}: o desktop é o padrão, e é o que o `app.routes.spec` monta.
 */
export function ehCelular(): Signal<boolean> {
  const celular = signal(false);

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return celular.asReadonly();
  }

  const consulta = window.matchMedia(LARGURA_DE_CELULAR);
  const aplicar = () => celular.set(consulta.matches);

  consulta.addEventListener('change', aplicar);
  inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', aplicar));

  aplicar();

  return celular.asReadonly();
}
