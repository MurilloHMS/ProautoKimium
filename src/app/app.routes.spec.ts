import { Route, UrlTree, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

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
   * - `convites` é a confirmação de presença: ser convidado basta (decisão de
   *   2026-10-01), e quem decide é a API — 404 para quem não foi convidado.
   */
  const FORA_DO_CONTROLE = ['home', 'unauthorized', 'notificacoes', 'convites'];

  /** Anda pela árvore inteira: as rotas do ERP moram sob o layout autenticado. */
  const todas = (lista: Route[], prefixo = ''): { path: string; data?: Record<string, unknown> }[] =>
    lista.flatMap(rota => {
      const path = [prefixo, rota.path].filter(Boolean).join('/');
      const filhas = rota.children ? todas(rota.children, path) : [];
      return rota.loadComponent
        ? [{ path, data: rota.data as Record<string, unknown> | undefined }, ...filhas]
        : filhas;
    });

  const autenticadas = todas(routes)
    .filter(r => !r.path.startsWith('cliente') && !FORA_DO_CONTROLE.includes(r.path));

  /**
   * As telas que juntam outras (2026-10-02: a Pendências junta férias,
   * reembolsos e atestados). Não têm código próprio na grade: o guard deixa
   * entrar quem abre **qualquer uma** das telas de `data.anyScreen`, e cada
   * uma tem que existir de verdade.
   */
  const juntas = autenticadas.filter(r => Array.isArray(r.data?.['anyScreen']));
  const controladas = autenticadas.filter(r => !juntas.includes(r));

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
   * Cada tela juntada continua existindo de um jeito ou de outro: como rota
   * própria (Férias, ainda no menu) ou como endereço antigo que **redireciona
   * para esta** (Visão de Equipe → Ausências). Uma tela que não é nenhum dos
   * dois foi digitada errado — e a junção ficaria aberta para ninguém.
   */
  it('a tela que junta outras aponta só para telas que existem ou que redirecionam para ela', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const existentes = new Set(controladas.map(r => r.data?.['screen']));
    const redireciona = new Map<string, string>();
    const andar = (lista: Route[], prefixo = '') => lista.forEach(rota => {
      const path = [prefixo, rota.path].filter(Boolean).join('/');
      if (typeof rota.redirectTo === 'string') {
        redireciona.set(path, rota.redirectTo.replace(/^\//, '').split('?')[0]);
      } else if (typeof rota.redirectTo === 'function') {
        // Redirecionamento com query (`?parte=cargos`): roda a função e lê o destino.
        const destino = TestBed.runInInjectionContext(() => (rota.redirectTo as (r: unknown) => UrlTree)({}));
        redireciona.set(path, destino.toString().replace(/^\//, '').split('?')[0]);
      }
      if (rota.children) andar(rota.children, path);
    });
    andar(routes);

    expect(juntas.map(r => r.path).sort())
      .toEqual(['rh/ausencias', 'rh/comunicados', 'rh/holerit', 'rh/organizacao', 'rh/pendencias']);
    for (const r of juntas) {
      const telas = r.data!['anyScreen'] as string[];
      expect(telas.length).withContext(r.path).toBeGreaterThan(0);
      const soltas = telas.filter(t => !existentes.has(t) && redireciona.get(t) !== r.path
                                       && t !== r.path && !t.startsWith(r.path + '/'));
      expect(soltas).withContext(r.path).toEqual([]);
    }
  });

  /**
   * O código da tela **é** a rota.
   *
   * Divergir é o pior dos dois mundos: a rota existe, o catálogo tem outra
   * coisa, e a pessoa vê "acesso negado" numa tela que ela pode acessar — com a
   * configuração dizendo que pode.
   */
  it('o screen declarado é igual ao path da rota', () => {
    // Rota com parâmetro (`rh/employees/:id`) é a mesma tela do caminho sem ele.
    const semParametro = (path: string) => path.replace(/\/:[^/]+$/, '');
    const divergentes = controladas
      .filter(r => r.data?.['screen'] !== semParametro(r.path))
      .map(r => ({ path: r.path, screen: r.data?.['screen'] }));

    expect(divergentes).toEqual([]);
  });

  /**
   * **Os links que a API grava nas notificações.** Ficam salvos no banco, então
   * mudar a API não conserta as notificações antigas — quem conserta é a rota.
   * `/reembolsos` e `/mural` caíam no 404 desde que nasceram.
   *
   * Lista copiada dos `notificationService.notify(…)` da API (2026-09-28):
   * ReimbursementService, AnnouncementService, EmployeeDocumentService e
   * HoleriteService. Link novo lá entra aqui — `/convites` é do EventReminderService.
   */
  it('todo link de notificação da API chega a uma tela', () => {
    const LINKS_DA_API = ['/reembolsos', '/mural', '/documentos', '/documentos/holerites',
      '/documentos/rh/documents', '/rh/employee-documents', '/convites'];

    const telas = new Set(todas(routes).map(r => r.path));
    const redirects = new Map<string, string>();
    const coletar = (lista: Route[], prefixo = ''): void => lista.forEach(rota => {
      const path = [prefixo, rota.path].filter(Boolean).join('/');
      if (typeof rota.redirectTo === 'string') {
        redirects.set(path, rota.redirectTo.startsWith('/') ? rota.redirectTo.slice(1)
          : [prefixo, rota.redirectTo].filter(Boolean).join('/'));
      }
      if (rota.children) coletar(rota.children, path);
    });
    coletar(routes);

    const quebrados = LINKS_DA_API
      .map(link => link.slice(1))
      .filter(path => !telas.has(path) && !telas.has(redirects.get(path) ?? ''));

    expect(quebrados).withContext('links que caem no 404').toEqual([]);
  });
});
