import { APP_MENU, AppMenuItem } from '../menu.config';
import { MenuService } from '../../../infrastructure/services/menu.service';
import {
  CategoriaDaGaveta,
  categoriasDaGaveta,
  comoResultado,
  destacar,
  destinosDe,
  primeirosDestinos,
} from './gaveta.model';

/**
 * A árvore do menu virando gaveta.
 *
 * <p><b>O defeito que este arquivo existe para impedir</b> é uma tela existir no
 * menu e ficar inalcançável na gaveta. A gaveta SUBSTITUI o menu hierárquico no
 * celular: o que ela não mostrar deixa de ter caminho — e some em silêncio, com
 * build verde. Já aconteceu uma vez neste projeto, com a newsletter.
 *
 * <p>Os testes rodam contra o `APP_MENU` de verdade, e não contra uma árvore de
 * mentirinha: é o menu real que tem três níveis em RH, dois grupos chamados
 * "Comunicação" e uma categoria de um item só.
 */
describe('gaveta.model', () => {

  /** Toda folha do menu, em profundidade — o universo que a gaveta tem que cobrir. */
  function folhasDoMenu(itens: AppMenuItem[]): AppMenuItem[] {
    return itens.flatMap(item =>
      item.items?.length ? folhasDoMenu(item.items) : [item]);
  }

  function profundidade(itens: AppMenuItem[], nivel = 1): number {
    return Math.max(nivel, ...itens.map(item =>
      item.items?.length ? profundidade(item.items, nivel + 1) : nivel));
  }

  const categorias = categoriasDaGaveta(APP_MENU);
  const acharCategoria = (id: string) =>
    categorias.find(c => c.id === id) as CategoriaDaGaveta;

  // ── a garantia ────────────────────────────────────────────────────────────

  /**
   * <b>O teste que vale mais que os outros juntos.</b> Uma asserção só, e ela
   * prova que a gaveta não perde nada — inclusive das categorias que ninguém
   * lembrou de conferir à mão.
   */
  it('a uniao dos destinos das categorias e igual a todas as folhas do menu', () => {
    const naGaveta = categorias.flatMap(destinosDe).map(d => d.label).sort();
    const noMenu = folhasDoMenu(APP_MENU).map(i => i.label).sort();

    expect(naGaveta)
      .withContext('tela que existe no menu e nao tem caminho na gaveta some do app')
      .toEqual(noMenu);
  });

  it('nenhum destino aparece duas vezes', () => {
    const todos = categorias.flatMap(destinosDe)
      .map(d => d.routerLink?.join('/') ?? d.url ?? d.label);

    expect(todos.length)
      .withContext('destino repetido faz a pessoa achar que sao duas telas')
      .toBe(new Set(todos).size);
  });

  // ── RH, o caso difícil ────────────────────────────────────────────────────

  /**
   * RH é o único com três níveis: uma folha solta e cinco subgrupos. A pasta
   * não aninha, então os subgrupos viram cabeçalhos de seção.
   */
  it('RH vira uma folha solta e cinco secoes com cabecalho', () => {
    const rh = acharCategoria('rh-recursos-humanos');

    expect(rh.tipo).toBe('pasta');

    const semTitulo = rh.secoes.filter(s => s.titulo === null);
    const comTitulo = rh.secoes.filter(s => s.titulo !== null);

    expect(semTitulo.length).withContext('uma primeira secao, das folhas soltas').toBe(1);
    expect(semTitulo[0].itens.map(i => i.label)).toEqual(['Painel RH']);

    expect(comTitulo.map(s => s.titulo))
      .toEqual(['Aprovações', 'Pessoas', 'Organização', 'Ferramentas', 'Comunicação']);
  });

  it('o tile de RH usa o rotulo curto, e a pasta o nome inteiro', () => {
    const rh = acharCategoria('rh-recursos-humanos');

    expect(rh.label).withContext('"RH - Recursos Humanos" nao cabe no tile').toBe('RH');
    expect(rh.labelCompleto).toBe('RH - Recursos Humanos');
  });

  /**
   * "Comunicação" existe no primeiro nível e dentro de RH. É por isso que os
   * subgrupos viram seções em vez de serem achatados: soltos, os três itens da
   * comunicação do RH ficariam ao lado de "Funcionários" sem nada explicando.
   */
  it('a Comunicacao do RH e a de primeiro nivel nao se misturam', () => {
    const rh = acharCategoria('rh-recursos-humanos');
    const dentroDoRh = rh.secoes.find(s => s.titulo === 'Comunicação')!.itens;
    const primeiroNivel = destinosDe(acharCategoria('comunicacao'));

    expect(dentroDoRh.length).toBeGreaterThan(0);
    expect(dentroDoRh.some(i => primeiroNivel.some(p => p.label === i.label)))
      .withContext('as duas comunicacoes sao conjuntos diferentes')
      .toBeFalse();
  });

  // ── a forma dos tiles ─────────────────────────────────────────────────────

  /**
   * O menu de hoje nao tem folha no primeiro nivel: Inicio, Documentos e
   * Galeria eram as tres, e foram agrupadas em "Meu espaco" em 2026-09-24
   * justamente para nao ficarem como tiles avulsos ao lado de categorias.
   *
   * O modelo continua sabendo lidar com uma — o teste abaixo prova isso com
   * menu sintetico —, e este aqui e o que avisa se ela voltar sem ninguem
   * decidir como a grade a mostra.
   */
  it('hoje nenhuma categoria do menu real e folha', () => {
    expect(categorias.filter(c => c.tipo === 'folha').map(c => c.label))
      .withContext('folha de primeiro nivel volta a ser tile avulso na grade')
      .toEqual([]);
  });

  it('folha de primeiro nivel, se existir, vira tile que navega', () => {
    const [inicio] = categoriasDaGaveta([
      { label: 'Início', icon: 'pi pi-home', routerLink: ['home'] },
    ]);

    expect(inicio.tipo).toBe('folha');
    expect(inicio.destino?.routerLink).toEqual(['home']);
    expect(inicio.secoes).toEqual([]);
  });

  /**
   * Financeiro tem um item só hoje. Se ele virasse tile-folha, a grade mudaria
   * de forma conforme a permissão de cada pessoa — e mudaria de novo no dia em
   * que o segundo item entrasse.
   */
  it('categoria de um item so continua sendo pasta', () => {
    const financeiro = acharCategoria('financeiro');

    expect(financeiro.tipo).toBe('pasta');
    expect(financeiro.total).toBe(1);
  });

  it('categoria sem nenhum filho nao vira pasta vazia', () => {
    const semFilhos = categoriasDaGaveta([
      { label: 'Vazia', icon: 'pi pi-box', items: [] },
    ]);

    expect(semFilhos[0].tipo)
      .withContext('pasta que abre e nao tem nada e pior que categoria ausente')
      .toBe('folha');
  });

  // ── externos ──────────────────────────────────────────────────────────────

  it('os Apps Externos vem marcados como externos', () => {
    const externos = destinosDe(acharCategoria('apps-externos'));

    expect(externos.length).toBeGreaterThan(0);
    expect(externos.every(d => d.externo))
      .withContext('sair do app e diferente de navegar dentro dele')
      .toBeTrue();
    expect(externos.every(d => !!d.url)).toBeTrue();
  });

  it('tela interna nao e marcada como externa', () => {
    expect(destinosDe(acharCategoria('estoque')).some(d => d.externo)).toBeFalse();
  });

  // ── o tile ────────────────────────────────────────────────────────────────

  it('o tile pede os primeiros N, e respeita a ordem que a tela escolher', () => {
    const empresa = acharCategoria('empresa');

    const naOrdemDoMenu = primeirosDestinos(empresa, 3);
    expect(naOrdemDoMenu.length).toBe(3);

    const deTras = primeirosDestinos(empresa, 3, todos => [...todos].reverse());
    expect(deTras[0].label)
      .withContext('e a tela que decide a ordem — o modelo so corta')
      .not.toBe(naOrdemDoMenu[0].label);
  });

  it('pedir mais do que existe devolve o que existe, sem buraco', () => {
    const financeiro = acharCategoria('financeiro');

    expect(primeirosDestinos(financeiro, 3).length).toBe(1);
  });

  // ── o contrato com o menu ─────────────────────────────────────────────────

  /**
   * O modelo achata neto de grupo na seção do pai, então um quarto nível
   * continua alcançável. Mas ele apareceria sem cabeçalho e ninguém teria
   * decidido isso — este teste é o aviso de que alguém precisa decidir.
   */
  it('o menu nao tem um quarto nivel, que a pasta nao saberia mostrar', () => {
    expect(profundidade(APP_MENU))
      .withContext('se passou de 3, decidir como a pasta mostra antes de mergear')
      .toBeLessThanOrEqual(3);
  });

  /**
   * O `achatar` desce em profundidade, e o menu de hoje nao exercita isso —
   * ele para no terceiro nivel. Sem este teste a recursao seria codigo sem
   * prova, e o dia em que o quarto nivel aparecesse a folha sumiria calada,
   * porque um grupo nao vira destino: ele nao tem rota.
   */
  it('um quarto nivel, se existir, e achatado na secao do pai — e nao sumido', () => {
    const comQuatro = categoriasDaGaveta([
      {
        label: 'Empresa', icon: 'pi pi-building',
        items: [
          {
            label: 'Frota', icon: 'pi pi-car',
            items: [
              { label: 'Abastecimento', icon: 'pi pi-gas', routerLink: ['a'] },
              {
                label: 'Manutencao', icon: 'pi pi-wrench',
                items: [{ label: 'Ordens', icon: 'pi pi-list', routerLink: ['b'] }],
              },
            ],
          },
        ],
      },
    ]);

    const frota = comQuatro[0].secoes.find(s => s.titulo === 'Frota')!;

    expect(frota.itens.map(i => i.label))
      .withContext('Ordens tem rota e precisa continuar alcancavel; Manutencao nao tem')
      .toEqual(['Abastecimento', 'Ordens']);
  });

  it('todo destino tem rotulo e icone', () => {
    const todos = categorias.flatMap(destinosDe);

    expect(todos.every(d => !!d.label?.trim()))
      .withContext('icone sem rotulo ja foi tentado e revertido: o publico e 40+')
      .toBeTrue();
    expect(todos.every(d => !!d.icon?.trim())).toBeTrue();
  });

  // ── identidade ────────────────────────────────────────────────────────────

  /**
   * Toda categoria do menu real tem cor. Categoria nova entra cinza — o que e
   * aceitavel —, mas entrar cinza SEM NINGUEM PERCEBER nao e: a grade fica com
   * um buraco visual e ninguem liga o defeito a quem criou o grupo.
   */
  it('as nove categorias do menu tem cor de identidade', () => {
    const semCor = categorias.filter(c => !c.cor).map(c => c.label);

    expect(semCor)
      .withContext('categoria nova precisa de uma cor no COR_DA_CATEGORIA')
      .toEqual([]);
  });

  it('nenhuma cor de categoria e usada duas vezes', () => {
    const cores = categorias.map(c => c.cor);

    expect(cores.length)
      .withContext('duas categorias da mesma cor voltam a ser indistinguiveis')
      .toBe(new Set(cores).size);
  });

  /** Categoria fora do mapa nao pode quebrar: cai no neutro. */
  it('categoria sem cor atribuida vem com cor vazia, e nao indefinida', () => {
    const [nova] = categoriasDaGaveta([
      { label: 'Categoria Nova', icon: 'pi pi-box', items: [
        { label: 'Uma tela', icon: 'pi pi-file', routerLink: ['x'] },
      ] },
    ]);

    expect(nova.cor).toBe('');
  });

  it('toda categoria tem rotulo e icone', () => {
    expect(categorias.every(c => !!c.label?.trim() && !!c.icon?.trim())).toBeTrue();
  });

  // ── a busca ─────────────────────────────────────────────────────────────

  describe('destacar', () => {

    it('casa sem acento e devolve o trecho com o acento original', () => {
      expect(destacar('Férias', 'feri')).toEqual({ antes: '', trecho: 'Féri', depois: 'as' });
    });

    it('acerta a posicao depois de letras acentuadas', () => {
      expect(destacar('Movimentações', 'acoes'))
        .toEqual({ antes: 'Moviment', trecho: 'ações', depois: '' });
      expect(destacar('Comunicação Protegida', 'prot'))
        .toEqual({ antes: 'Comunicação ', trecho: 'Prot', depois: 'egida' });
    });

    it('casou so pelo caminho: sem destaque', () => {
      expect(destacar('Produtos', 'estoque')).toEqual({ antes: 'Produtos', trecho: '', depois: '' });
    });
  });

  describe('comoResultado', () => {

    const item = (breadcrumb: string, label: string) =>
      ({ label, icon: 'pi pi-x', breadcrumb, path: '/x', routerLink: ['x'] });

    it('o caminho e o breadcrumb sem a propria tela, com a raiz curta', () => {
      const resultado = comoResultado(item('RH - Recursos Humanos › Aprovações › Férias', 'Férias'), 'fe');

      expect(resultado.caminho).toBe('RH › Aprovações');
      expect(resultado.cor).toBe('rh');
    });

    it('folha de primeiro nivel nao tem caminho', () => {
      expect(comoResultado(item('Início', 'Início'), 'ini').caminho).toBe('');
    });

    it('os dois "Eventos" do menu de verdade saem com caminhos diferentes', () => {
      const proto = MenuService.prototype as any;
      const plano: any[] = proto.flatten.call({ flatten: proto.flatten }, APP_MENU);

      const eventos = plano.filter(i => i.label === 'Eventos').map(i => comoResultado(i, 'ev'));

      expect(eventos.length).toBe(2);
      expect(new Set(eventos.map(e => e.caminho)).size).toBe(2);
    });
  });
});
