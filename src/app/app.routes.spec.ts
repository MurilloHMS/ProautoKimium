import { Route } from '@angular/router';

import { routes } from './app.routes';

/**
 * O contrato entre as rotas e o catálogo de permissões.
 *
 * Uma rota autenticada sem `data.screen` **passa pelo guard sem ser checada** —
 * fica aberta para qualquer pessoa logada, e nada denuncia: o build passa, a
 * tela abre, e só um teste como este percebe.
 *
 * É o contrário do defeito que a sincronização cobre. Lá o risco é a tela sumir
 * para todo mundo; aqui é ela ficar visível para todo mundo.
 *
 * Importar as rotas é barato: `loadComponent` é uma função preguiçosa e não
 * executa no import — o que chega aqui é o array, não os 55 componentes.
 */
describe('app.routes · o catálogo de telas', () => {

  /**
   * Não participam do controle, e a razão de cada uma:
   *
   * - `unauthorized` é a própria tela de acesso negado. Trancá-la deixaria a
   *   pessoa barrada sem nem o aviso de que foi barrada.
   * - `home` e `notificacoes` são o mínimo que todo logado precisa.
   * - `cliente/*` é o portal, que tem sessão e escopo próprios.
   */
  const FORA_DO_CONTROLE = ['home', 'unauthorized', 'notificacoes'];

  /** Anda pela árvore inteira: as rotas do ERP moram sob o layout autenticado. */
  const todas = (lista: Route[], prefixo = ''): { path: string; data?: Record<string, unknown> }[] =>
    lista.flatMap(rota => {
      const path = [prefixo, rota.path].filter(Boolean).join('/');
      const filhas = rota.children ? todas(rota.children, path) : [];
      return rota.loadComponent
        ? [{ path, data: rota.data as Record<string, unknown> | undefined }, ...filhas]
        : filhas;
    });

  const controladas = todas(routes)
    .filter(r => !r.path.startsWith('cliente') && !FORA_DO_CONTROLE.includes(r.path));

  it('encontrou as rotas autenticadas', () => {
    // Se este número despencar, a travessia parou de funcionar — e os outros
    // testes passariam vazios, sem afirmar nada.
    expect(controladas.length).toBeGreaterThan(40);
  });

  /** **O teste que importa.** Sem `data.screen`, o guard deixa passar sem checar. */
  it('toda rota autenticada declara data.screen', () => {
    const semScreen = controladas.filter(r => !r.data?.['screen']).map(r => r.path);

    expect(semScreen).toEqual([]);
  });

  /**
   * O código da tela **é** a rota.
   *
   * Divergir é o pior dos dois mundos: a rota existe, o catálogo tem outra
   * coisa, e a pessoa vê "acesso negado" numa tela que ela pode acessar — com a
   * configuração dizendo que pode.
   */
  it('o screen declarado é igual ao path da rota', () => {
    const divergentes = controladas
      .filter(r => r.data?.['screen'] !== r.path)
      .map(r => ({ path: r.path, screen: r.data?.['screen'] }));

    expect(divergentes).toEqual([]);
  });
});
