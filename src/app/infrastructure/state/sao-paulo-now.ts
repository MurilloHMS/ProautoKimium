import { DestroyRef, Signal, inject, signal } from '@angular/core';

import { SaoPauloNow, nowInSaoPaulo } from '../../domain/utils/events';

/** De quanto em quanto o "agora" anda. Palestra muda de estado de minuto em minuto. */
const INTERVALO_MS = 30_000;

/**
 * Um `signal` com o "agora" de São Paulo, que anda sozinho enquanto a tela está
 * aberta — é o que faz o "Agora" pular para a palestra seguinte sem recarregar.
 *
 * **Pausa com a aba escondida**, e atualiza na hora em que ela volta: um celular
 * que ficou no bolso a manhã inteira abre mostrando a palestra certa, e não a de
 * quando foi guardado.
 *
 * Chamar dentro de um contexto de injeção (construtor ou inicializador de campo).
 */
export function saoPauloNowSignal(): Signal<SaoPauloNow> {
  const destroyRef = inject(DestroyRef);
  const agora = signal(nowInSaoPaulo());

  const atualizar = () => {
    const novo = nowInSaoPaulo();
    const atual = agora();
    if (novo.date !== atual.date || novo.time !== atual.time) agora.set(novo);
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  const ligar = () => {
    if (timer) return;
    atualizar();
    timer = setInterval(atualizar, INTERVALO_MS);
  };
  const desligar = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };
  const aoMudarVisibilidade = () => (document.hidden ? desligar() : ligar());

  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  if (!document.hidden) ligar();

  destroyRef.onDestroy(() => {
    desligar();
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  });

  return agora.asReadonly();
}
