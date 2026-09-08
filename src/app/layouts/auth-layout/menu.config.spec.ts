import type { Route } from '@angular/router';

import { routes } from '../../app.routes';
import { APP_MENU, MOBILE_NAV, type AppMenuItem } from './menu.config';

/**
 * O menu e as rotas, um contra o outro.
 *
 * **Este arquivo existe por causa de um defeito real.** A tela de revisão da
 * newsletter ganhou componente, rota, permissão e migration — e não apareceu
 * para ninguém, porque o menu é uma lista estática à parte e ficou de fora. O
 * build passou, os testes passaram, e o sintoma pareceu problema de permissão.
 *
 * Nenhuma das duas listas é derivada da outra, então nada além daqui percebe
 * quando elas se separam.
 */
describe('menu.config × app.routes', () => {

  /** Toda `screen` declarada nas rotas, subindo pela árvore inteira. */
  function screensDasRotas(lista: readonly Route[]): Set<string> {
    const encontradas = new Set<string>();

    const andar = (rotas: readonly Route[]) => {
      for (const rota of rotas) {
        const screen = rota.data?.['screen'];
        if (typeof screen === 'string') {
          encontradas.add(screen);
        }
        if (rota.children) {
          andar(rota.children);
        }
      }
    };

    andar(lista);
    return encontradas;
  }

  function itensDoMenu(itens: readonly AppMenuItem[]): AppMenuItem[] {
    return itens.flatMap(item => [item, ...(item.items ? itensDoMenu(item.items) : [])]);
  }

  /**
   * As duas navegações contam.
   *
   * A gaveta é a do computador; o `MOBILE_NAV` é a barra de baixo do celular, e
   * tem telas que só vivem lá — o Perfil se abre pela barra e pelo avatar, e
   * nunca precisou de linha na gaveta.
   */
  const screensDoMenu = new Set(
    [...itensDoMenu(APP_MENU), ...itensDoMenu(MOBILE_NAV)]
      .map(i => i.screen).filter((s): s is string => !!s));

  const screens = screensDasRotas(routes);

  /**
   * As telas que existem sem entrada no menu, por decisão.
   *
   * São subtelas de hub: quem chega nelas vem de um cartão, não da gaveta.
   * Repetir cada uma no menu deixaria a gaveta com o dobro do tamanho e a
   * mesma informação.
   *
   * **A lista é o ponto do teste.** Rota nova que não estiver no menu quebra
   * aqui até alguém decidir uma das duas coisas — e essa decisão passa a ser
   * escrita, em vez de esquecida.
   */
  const SEM_MENU_DE_PROPOSITO = new Set([
    // Calculadoras: abrem pelo hub em documentos/calculadoras.
    'documentos/calculadoras/cmv',
    'documentos/calculadoras/combustivel',
    // Documentos e RH: o hub é a porta, e as subtelas são os cartões dele.
    'documentos/calculadoras',
    'documentos/holerites',
    'documentos/logos',
    'documentos/rh',
    'documentos/rh/announcements',
    'documentos/rh/documents',
    'documentos/rh/medical-certificates',
    'documentos/rh/reimbursements',
    'documentos/rh/vacation-requests',
    'rh/candidaturas',
    // Ferramentas de PDF: idem, saem do hub de ferramentas.
    'tools/pdf/nfse-rename',
    'tools/pdf/unlock',
  ]);

  it('toda tela com rota está no menu, ou na lista de exceções', () => {
    const foraDoMenu = [...screens]
      .filter(s => !screensDoMenu.has(s) && !SEM_MENU_DE_PROPOSITO.has(s));

    expect(foraDoMenu)
      .withContext('tela com rota e sem menu não abre para ninguém — inclua no menu ' +
                   'ou em SEM_MENU_DE_PROPOSITO, dizendo por quê')
      .toEqual([]);
  });

  /** O contrário: entrada de menu apontando para tela que não existe é link morto. */
  it('todo item de menu aponta para uma tela que tem rota', () => {
    const semRota = [...screensDoMenu].filter(s => !screens.has(s));

    expect(semRota)
      .withContext('item de menu sem rota leva a lugar nenhum')
      .toEqual([]);
  });

  /**
   * O `screen` e o `routerLink` do mesmo item precisam concordar.
   *
   * Foi assim que o código da tela nova entrou errado uma vez: a rota em
   * `communication/`, a permissão em `comunicacao/`. O guard pedia uma
   * authority e a API outra, e o sintoma era 403 para quem tinha o acesso.
   */
  it('o screen de cada item bate com o próprio routerLink', () => {
    const divergentes = [...itensDoMenu(APP_MENU), ...itensDoMenu(MOBILE_NAV)]
      .filter(i => i.screen && i.routerLink)
      .filter(i => i.routerLink!.join('/') !== i.screen)
      .map(i => `${i.label}: ${i.routerLink!.join('/')} ≠ ${i.screen}`);

    expect(divergentes).toEqual([]);
  });
});
