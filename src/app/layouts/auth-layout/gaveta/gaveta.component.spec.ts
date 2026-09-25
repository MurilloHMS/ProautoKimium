import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

import { GavetaComponent } from './gaveta.component';
import { AppMenuItem } from '../menu.config';
import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { providersDeTeste } from '../../../../testing/test-setup';

/**
 * A gaveta desenhada.
 *
 * <p>O modelo já é coberto por `gaveta.model.spec.ts`; aqui o que se prova é o
 * <b>contrato do DOM</b>: que forma abre pasta e que forma navega, que todo
 * item tem texto, e que a pasta é descendente do painel — sem isso ela abre
 * invisível atrás da gaveta, por z-index.
 */
describe('GavetaComponent', () => {
  let fixture: ComponentFixture<GavetaComponent>;

  // O RH do menu de verdade tem 16 destinos em 5 subgrupos. O fixture tem que
  // ser grande o bastante para sobrar item fora do cartao — senao a pasta nao
  // tem como abrir, e o teste passaria a exercitar outro caminho.
  const MENU: AppMenuItem[] = [
    { label: 'Início', icon: 'pi pi-home', routerLink: ['home'] },
    {
      label: 'Empresa', icon: 'pi pi-building',
      items: [
        { label: 'Abastecimento', icon: 'pi pi-car', routerLink: ['company/fuel-supply'] },
        { label: 'Equipamentos', icon: 'pi pi-wrench', routerLink: ['company/equipments'] },
        { label: 'Clientes', icon: 'pi pi-users', routerLink: ['company/customers'] },
        { label: 'Guia', icon: 'pi pi-book', routerLink: ['company/guide'] },
      ],
    },
    {
      label: 'RH - Recursos Humanos', icon: 'pi pi-users',
      items: [
        { label: 'Painel RH', icon: 'pi pi-chart-bar', routerLink: ['rh/hub'] },
        {
          label: 'Aprovações', icon: 'pi pi-check',
          items: [
            { label: 'Férias', icon: 'pi pi-sun', routerLink: ['rh/vacation-requests'] },
            { label: 'Reembolsos', icon: 'pi pi-wallet', routerLink: ['rh/reimbursements'] },
            { label: 'Atestados', icon: 'pi pi-heart', routerLink: ['rh/medical-certificates'] },
          ],
        },
        {
          label: 'Pessoas', icon: 'pi pi-id-card',
          items: [
            { label: 'Funcionários', icon: 'pi pi-users', routerLink: ['rh/employees'] },
            { label: 'Visão de Equipe', icon: 'pi pi-sitemap', routerLink: ['rh/team-overview'] },
          ],
        },
      ],
    },
    {
      label: 'Apps Externos', icon: 'pi pi-external-link',
      items: [
        { label: 'NextCloud', icon: 'pi pi-cloud', url: 'https://nuvem.exemplo', target: '_blank' },
      ],
    },
  ];

  const habito = signal<any[]>([]);

  /**
   * O `search` e o `flatten` são os de verdade, emprestados do protótipo. A
   * gaveta não tem busca própria — usa a da topbar —, e um dublê que
   * reimplementasse a busca testaria o dublê.
   */
  function menuDeTeste() {
    const proto = MenuService.prototype as any;
    const plano = proto.flatten.call({ flatten: proto.flatten }, MENU);
    return {
      menu: () => MENU,
      flatItems: () => plano,
      search(query: string) { return proto.search.call(this, query); },
    };
  }

  async function montar(aberta = true): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GavetaComponent],
      providers: [
        ...providersDeTeste(),
        { provide: MenuService, useValue: menuDeTeste() },
        { provide: TelasRecentesService, useValue: { porHabito: habito } },
      ],
    }).compileComponents();

    // O clique num routerLink navega de verdade; sem isto a navegacao resolve
    // depois do teste e estoura NG0205 no injetor ja destruido.
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    // Fechar a gaveta consome a entrada de historico dela (camadaVoltavel).
    // Espiar nao e' so' isolamento: o iframe do Karma divide o historico com a
    // pagina que o hospeda, e um back() de verdade aqui leva o runner junto.
    spyOn(window.history, 'pushState');
    spyOn(window.history, 'back');

    fixture = TestBed.createComponent(GavetaComponent);
    fixture.componentRef.setInput('open', aberta);
    fixture.detectChanges();
  }

  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => habito.set([]));

  // ── a grade ───────────────────────────────────────────────────────────────

  it('desenha um tile por categoria', async () => {
    await montar();

    expect(raiz().querySelectorAll('.tile').length).toBe(4);
  });

  /**
   * A forma é o que diz o que acontece ao tocar: folha navega, pasta abre por
   * cima. Se as duas fossem iguais, a diferença custaria um toque para
   * descobrir.
   */
  it('folha de primeiro nivel e um link, e nao abre pasta', async () => {
    await montar();

    const folha = raiz().querySelector('.tile--folha') as HTMLAnchorElement;

    expect(folha).not.toBeNull();
    expect(folha.tagName).toBe('A');

    folha.click();
    fixture.detectChanges();

    expect(raiz().querySelector('.pk-sheet'))
      .withContext('tile de folha navega — nao abre pasta')
      .toBeNull();
  });

  /**
   * O cartao e 2x2. Ate quatro destinos os quatro aparecem e nao ha "ver
   * mais" — abrir uma pasta para ver o que ja esta na tela nao leva a lugar
   * nenhum. Empresa tem exatamente quatro, e e a fronteira.
   */
  it('categoria com quatro destinos mostra os quatro, sem ver mais', async () => {
    await montar();

    const empresa = Array.from(raiz().querySelectorAll('.tile--pasta'))
      .find(t => t.textContent?.includes('Empresa')) as HTMLElement;

    expect(empresa.querySelectorAll('a.mini').length).toBe(4);
    expect(empresa.querySelector('.mini--resto')).toBeNull();
  });

  it('acima de quatro, entram tres e a quarta celula abre a pasta', async () => {
    await montar();

    const rh = Array.from(raiz().querySelectorAll('.tile--pasta'))
      .find(t => t.textContent?.includes('RH')) as HTMLElement;

    expect(rh.querySelectorAll('a.mini').length)
      .withContext('tres apps mais a celula de ver mais fecham o 2x2')
      .toBe(3);

    const resto = rh.querySelector('.mini--resto') as HTMLButtonElement;
    expect(resto).not.toBeNull();

    resto.click();
    fixture.detectChanges();

    expect(raiz().querySelector('.pk-sheet__titulo')?.textContent)
      .toContain('RH - Recursos Humanos');
  });

  it('categoria sem sobra nao mostra aglomerado', async () => {
    await montar();

    const externos = Array.from(raiz().querySelectorAll('.tile--pasta'))
      .find(t => t.textContent?.includes('Externos')) as HTMLElement;

    expect(externos.querySelector('.mini--resto'))
      .withContext('1 item cabe inteiro no cartao — "ver tudo" ali nao leva a lugar nenhum novo')
      .toBeNull();
  });

  // ── a pasta ───────────────────────────────────────────────────────────────

  /**
   * <b>O teste do z-index.</b> `$z-drawer` é 1100 e a `pk-sheet` é 1050: irmã
   * da gaveta, a pasta abriria invisível atrás dela. Só funciona por ser
   * descendente do painel, que tem `transform` e cria bloco contentor.
   */
  it('a pasta e descendente do painel da gaveta, e nao irma', async () => {
    await montar();

    (raiz().querySelector('.mini--resto') as HTMLButtonElement).click();
    fixture.detectChanges();

    // A primeira categoria com sobra e o RH; qualquer uma serve para este teste.
    const painel = raiz().querySelector('.gaveta__painel')!;
    const folha = raiz().querySelector('.pk-sheet')!;

    expect(painel.contains(folha))
      .withContext('irma da gaveta, a pasta abre atras dela por z-index')
      .toBeTrue();
  });

  it('a pasta do RH mostra o cabecalho da secao e as telas dela', async () => {
    await montar();

    const rh = Array.from(raiz().querySelectorAll('.tile--pasta'))
      .find(t => t.textContent?.includes('RH')) as HTMLElement;

    (rh.querySelector('.mini--resto') as HTMLButtonElement)?.click();
    fixture.detectChanges();

    const corpo = raiz().querySelector('.pasta')!;

    expect(corpo.querySelector('.pasta__secao')?.textContent).toContain('Aprovações');
    expect(corpo.textContent).toContain('Painel RH');
    expect(corpo.textContent).toContain('Férias');
  });

  it('o corpo da gaveta fica inerte enquanto a pasta esta aberta', async () => {
    await montar();

    (raiz().querySelector('.mini--resto') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(raiz().querySelector('.gaveta__corpo')?.hasAttribute('inert'))
      .withContext('sem isto o Tab entra na grade por baixo da pasta')
      .toBeTrue();
  });

  // ── rótulos e externos ────────────────────────────────────────────────────

  /**
   * Ícone sem rótulo já foi implementado e revertido pelo dono, pensando em
   * quem tem 40+. A asserção é no DOM de propósito: `aria-label` não salva
   * quem enxerga.
   */
  it('todo tile e toda miniatura tem texto visivel', async () => {
    await montar();

    const comTexto = (selector: string) =>
      Array.from(raiz().querySelectorAll(selector))
        .every(el => !!el.textContent?.trim());

    expect(comTexto('.tile')).withContext('tile sem rotulo vira adivinhacao').toBeTrue();
    expect(comTexto('.mini')).toBeTrue();
  });

  it('app externo e ancora de verdade, com target e rel', async () => {
    await montar();

    const externo = Array.from(raiz().querySelectorAll('a.mini'))
      .find(a => (a as HTMLAnchorElement).href.includes('nuvem.exemplo')) as HTMLAnchorElement;

    expect(externo)
      .withContext('window.open e bloqueado pelo Safari do iOS e mata o toque longo')
      .not.toBeNull();
    expect(externo.target).toBe('_blank');
    expect(externo.rel).toContain('noopener');
  });

  // ── hábito ────────────────────────────────────────────────────────────────

  /**
   * Os três do cartão saem do hábito, e é o que faz a tela mais usada ficar a
   * um toque. Sem isso o cartão vira a ordem do menu, que ninguém escolheu.
   */
  it('o cartao mostra primeiro o que a pessoa mais usa', async () => {
    habito.set([{ path: '/company/guide', visitas: 30, ultimoAcesso: 2 }]);
    await montar();

    const empresa = Array.from(raiz().querySelectorAll('.tile--pasta'))
      .find(t => t.textContent?.includes('Empresa')) as HTMLElement;

    const primeiro = empresa.querySelector('.mini__rotulo')?.textContent?.trim();

    expect(primeiro)
      .withContext('"Guia" e o ultimo do menu e o mais usado: tem que subir')
      .toBe('Guia');
  });

  it('sem historico, o cartao segue a ordem do menu', async () => {
    await montar();

    const empresa = Array.from(raiz().querySelectorAll('.tile--pasta'))
      .find(t => t.textContent?.includes('Empresa')) as HTMLElement;

    expect(empresa.querySelector('.mini__rotulo')?.textContent?.trim()).toBe('Abastecimento');
  });

  // ── fechar ────────────────────────────────────────────────────────────────

  it('escolher um destino fecha a gaveta', async () => {
    await montar();

    let fechou = false;
    fixture.componentInstance.closed.subscribe(() => (fechou = true));

    (raiz().querySelector('.tile--folha') as HTMLAnchorElement).click();
    fixture.detectChanges();

    expect(fechou).toBeTrue();
  });

  /**
   * O `Esc` da gaveta e o da `pk-sheet` escutam o mesmo evento. Sem a saída
   * antecipada, um toque fecharia as duas camadas de uma vez.
   */
  it('Esc com a pasta aberta nao fecha a gaveta junto', async () => {
    await montar();

    let fechou = false;
    fixture.componentInstance.closed.subscribe(() => (fechou = true));

    (raiz().querySelector('.mini--resto') as HTMLButtonElement).click();
    fixture.detectChanges();

    fixture.componentInstance.aoEsc();

    expect(fechou)
      .withContext('a pasta fecha primeiro; a gaveta so no proximo Esc')
      .toBeFalse();
  });

  /**
   * O `Esc` nao fecha mais na mao: ele pede o voltar ao navegador, e quem fecha
   * e' o `popstate` que volta. E' o mesmo caminho do X e do voltar do aparelho
   * — um so', em vez de tres que precisam concordar. Coberto em
   * `gaveta-voltar.spec.ts`.
   */
  it('Esc sem pasta aberta pede o voltar, e o voltar fecha a gaveta', async () => {
    await montar();

    let fechou = false;
    fixture.componentInstance.closed.subscribe(() => (fechou = true));

    fixture.componentInstance.aoEsc();

    expect(window.history.back).withContext('consome a entrada').toHaveBeenCalled();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { navigationId: 1 } }));

    expect(fechou).toBeTrue();
  });

  // ── a busca ───────────────────────────────────────────────────────────────

  const campo = () => raiz().querySelector('.gaveta__busca-campo') as HTMLInputElement;

  const lupa = () => raiz().querySelector('.gaveta__lupa') as HTMLButtonElement;
  const linha = () => raiz().querySelector('.gaveta__titulo-linha') as HTMLElement;

  function abrirBusca(): void {
    lupa().click();
    fixture.detectChanges();
  }

  /** Abre pela lupa quando preciso, como a pessoa faria. */
  function digitar(texto: string): void {
    if (!fixture.componentInstance.buscaAberta()) abrirBusca();
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const rotulos = () => Array.from(raiz().querySelectorAll('.resultado__rotulo'))
    .map(el => el.textContent!.trim());

  it('o campo de busca mora na cabeca, fora do corpo que rola', async () => {
    await montar();

    expect(raiz().querySelector('.gaveta__cabeca .gaveta__busca-campo'))
      .withContext('no corpo ele sairia da vista com a grade rolada')
      .not.toBeNull();
  });

  it('com texto, a grade sai e a lista entra', async () => {
    await montar();

    digitar('abast');

    expect(raiz().querySelectorAll('.tile').length).withContext('grade').toBe(0);
    expect(rotulos()).toEqual(['Abastecimento']);
  });

  /**
   * "Eventos", "PDF" e "Equipamentos" existem em dois lugares cada no menu de
   * verdade. Sem o caminho, seriam linhas iguais.
   */
  it('cada resultado mostra onde a tela mora, com a raiz encurtada como no cartao', async () => {
    await montar();

    digitar('reembolso');

    const caminho = raiz().querySelector('.resultado__caminho')!.textContent!.trim();

    expect(caminho).toBe('RH › Aprovações');
  });

  it('destaca o trecho digitado mesmo sem acento', async () => {
    await montar();

    digitar('feri');

    expect(raiz().querySelector('.resultado__rotulo mark')?.textContent).toBe('Féri');
  });

  it('sem resultado, diz o que foi buscado em vez de lista vazia', async () => {
    await montar();

    digitar('salario');

    expect(raiz().querySelector('.resultados')).toBeNull();
    expect(raiz().querySelector('.busca-vazia')?.textContent).toContain('salario');
  });

  it('apagar o texto devolve a grade', async () => {
    await montar();

    digitar('abast');
    digitar('');

    expect(raiz().querySelectorAll('.tile').length).toBe(4);
  });

  it('o botao de limpar esvazia o campo e devolve o foco a ele', async () => {
    await montar();
    document.body.appendChild(raiz());

    digitar('abast');
    (raiz().querySelector('.gaveta__busca-limpar') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(campo().value).toBe('');
    expect(document.activeElement).toBe(campo());

    raiz().remove();
  });

  it('Enter abre o primeiro resultado e fecha a gaveta', async () => {
    await montar();

    let fechou = false;
    fixture.componentInstance.closed.subscribe(() => (fechou = true));

    digitar('reembolso');
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/rh/reimbursements');
    expect(fechou).toBeTrue();
  });

  it('Esc com a busca aberta fecha o campo e deixa a gaveta aberta', async () => {
    await montar();

    digitar('abast');
    fixture.componentInstance.aoEsc();
    fixture.detectChanges();

    expect(window.history.back).withContext('nao pode fechar a gaveta').not.toHaveBeenCalled();
    expect(fixture.componentInstance.buscaAberta()).toBeFalse();
    expect(campo().value).toBe('');
    expect(raiz().querySelectorAll('.tile').length).toBe(4);
  });

  // ── a lupa ────────────────────────────────────────────────────────────────

  it('fechado, o campo fica fora do Tab e escondido do leitor de tela', async () => {
    await montar();

    expect(campo().getAttribute('tabindex')).toBe('-1');
    expect(raiz().querySelector('.gaveta__campo')!.getAttribute('aria-hidden')).toBe('true');
  });

  /**
   * No Safari do iPhone o teclado so sobe se o foco acontecer dentro do toque.
   * Por isso o teste confere o foco logo depois do clique, SEM `detectChanges`
   * e sem esperar nada: foco que precisasse de um ciclo a mais abriria o campo
   * com o teclado fechado.
   */
  it('a lupa abre o campo e o foco chega nele dentro do proprio toque', async () => {
    await montar();
    document.body.appendChild(raiz());

    lupa().click();

    expect(document.activeElement).withContext('no mesmo tique do clique').toBe(campo());

    fixture.detectChanges();

    expect(linha().classList).toContain('gaveta__titulo-linha--buscando');
    expect(lupa().getAttribute('aria-expanded')).toBe('true');
    expect(campo().hasAttribute('tabindex')).withContext('aberto, volta ao Tab').toBeFalse();

    raiz().remove();
  });

  it('com a busca aberta, o titulo, a lupa e o X ficam inertes por baixo', async () => {
    await montar();

    abrirBusca();

    expect(raiz().querySelector('.gaveta__acoes')!.hasAttribute('inert')).toBeTrue();
  });

  it('aberta e vazia, a grade continua na tela', async () => {
    await montar();

    abrirBusca();

    expect(raiz().querySelectorAll('.tile').length).toBe(4);
  });

  it('Cancelar fecha o campo, esquece o texto e devolve o foco a lupa', async () => {
    await montar();
    document.body.appendChild(raiz());

    digitar('abast');
    (raiz().querySelector('.gaveta__cancelar') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(linha().classList).not.toContain('gaveta__titulo-linha--buscando');
    expect(campo().value).toBe('');
    expect(document.activeElement).toBe(lupa());

    raiz().remove();
  });

  /**
   * A busca e uma camada, como a pasta: o voltar do Android fecha ela e
   * repoe a entrada, senao o proximo voltar sairia da tela.
   */
  it('o voltar do aparelho fecha a busca e a gaveta continua', async () => {
    await montar();

    let fechou = false;
    fixture.componentInstance.closed.subscribe(() => (fechou = true));

    digitar('abast');
    const empilhadas = (window.history.pushState as jasmine.Spy).calls.count();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { navigationId: 1 } }));
    fixture.detectChanges();

    expect(fechou).withContext('a gaveta').toBeFalse();
    expect(fixture.componentInstance.buscaAberta()).toBeFalse();
    expect((window.history.pushState as jasmine.Spy).calls.count())
      .withContext('repoe a entrada da gaveta')
      .toBe(empilhadas + 1);
  });

  it('fechar a gaveta esquece a busca', async () => {
    await montar();

    digitar('abast');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(campo().value).toBe('');
    expect(raiz().querySelectorAll('.tile').length).toBe(4);
  });

  it('o leitor de tela ouve quantas telas foram achadas', async () => {
    await montar();

    digitar('abast');

    expect(raiz().querySelector('[aria-live]')?.textContent?.trim()).toBe('1 tela encontrada');
  });
});
