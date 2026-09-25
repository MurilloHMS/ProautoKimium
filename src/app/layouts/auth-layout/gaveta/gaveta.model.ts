import { AppMenuItem } from '../menu.config';
import { FlatMenuItem, dobrarAcento } from '../../../infrastructure/services/menu.service';

/**
 * A árvore do menu virando gaveta de apps.
 *
 * <p>Isto é função pura, sem injeção: recebe o menu **já filtrado por
 * permissão** pelo `MenuService.menu()` e devolve a forma que a tela desenha.
 * Pura porque é aqui que mora a regra difícil — os três níveis do RH — e o
 * teste dela não deveria precisar montar componente.
 *
 * <p><b>A garantia que importa:</b> a união de todos os destinos que
 * {@link categoriasDaGaveta} devolve é igual à lista plana do menu. Nenhuma das
 * 70 telas pode ficar inalcançável porque a gaveta não soube onde pô-la —
 * é o mesmo defeito que já escondeu a newsletter de todo mundo uma vez.
 */

/** Uma tela, do jeito que a gaveta precisa para desenhar e navegar. */
export interface DestinoDaGaveta {
  label: string;
  icon: string;
  routerLink?: string[];
  url?: string;
  target?: string;
  /** Link que sai do app. Muda a marca no tile e o elemento (`<a>`, não botão). */
  externo: boolean;
}

/**
 * Um bloco dentro da pasta.
 *
 * <p>`titulo` nulo é a primeira seção, das folhas que penduram direto na
 * categoria — o `Painel RH`, por exemplo. Ela não ganha cabeçalho porque um
 * cabeçalho ali teria que se chamar "Geral", e isso é ruído.
 */
export interface SecaoDaPasta {
  titulo: string | null;
  itens: DestinoDaGaveta[];
}

/**
 * Um tile da grade.
 *
 * <p>`tipo` é o que a forma comunica: `folha` navega no toque, `pasta` abre por
 * cima. O sinal visual é o poço com miniaturas — e ele segue o **contêiner**,
 * não a contagem: `Financeiro` tem um item só e continua sendo pasta, senão a
 * grade mudaria de forma conforme a permissão de cada pessoa.
 */
export interface CategoriaDaGaveta {
  /** Estável para o `track` e para a URL da pasta. Sai do rótulo original. */
  id: string;
  /** O que cabe no tile. */
  label: string;
  /** O que vai no cabeçalho da pasta, por extenso. */
  labelCompleto: string;
  icon: string;
  tipo: 'pasta' | 'folha';
  /** Só em `folha`: para onde o tile navega. */
  destino?: DestinoDaGaveta;
  /** Só em `pasta`. */
  secoes: SecaoDaPasta[];
  /** Quantos destinos a pasta tem, somando as seções. Alimenta o "+14". */
  total: number;
  /**
   * O sufixo do token de identidade — `espaco` vira `--cat-espaco`.
   *
   * Vazio quando a categoria não tem cor atribuída: a grade cai no neutro em
   * vez de quebrar, e uma categoria nova nasce cinza até alguém escolher.
   */
  cor: string;
}

/**
 * Categoria → cor da marca.
 *
 * <p>Mora aqui, e não no `menu.config.ts`, pela mesma razão do
 * {@link ROTULO_CURTO}: o desktop não tem cor de categoria e não precisa saber
 * que ela existe.
 *
 * <p>As nove vêm da paleta de apoio da marca (`/branding`), que existe
 * exatamente para identidade. A doutrina, o escopo e as medições estão no
 * `_tokens.scss`.
 */
export const COR_DA_CATEGORIA: Record<string, string> = {
  'meu-espaco': 'espaco',
  'rh-recursos-humanos': 'rh',
  'financeiro': 'financeiro',
  'empresa': 'empresa',
  'comunicacao': 'comunicacao',
  'estoque': 'estoque',
  'ferramentas': 'ferramentas',
  'configuracoes': 'config',
  'apps-externos': 'externos',
};

/**
 * Rótulos que não cabem no tile.
 *
 * <p>Mora aqui e **não** no `menu.config.ts` de propósito: o desktop continua
 * lendo "RH - Recursos Humanos" na árvore dele, sem saber que a gaveta existe.
 * A pasta também mostra o nome inteiro; o encurtamento é só do tile.
 */
export const ROTULO_CURTO: Record<string, string> = {
  'RH - Recursos Humanos': 'RH',
  'Apps Externos': 'Externos',
};

export function categoriasDaGaveta(menu: AppMenuItem[]): CategoriaDaGaveta[] {
  return menu.map(item => ehGrupo(item) ? comoPasta(item) : comoFolha(item));
}

/** Todos os destinos de uma categoria, em ordem. Base do teste da união. */
export function destinosDe(categoria: CategoriaDaGaveta): DestinoDaGaveta[] {
  return categoria.tipo === 'folha'
    ? (categoria.destino ? [categoria.destino] : [])
    : categoria.secoes.flatMap(secao => secao.itens);
}

/** Os N primeiros destinos, na ordem que a tela pedir. Alimenta o tile. */
export function primeirosDestinos(
  categoria: CategoriaDaGaveta,
  quantos: number,
  ordenar?: (destinos: DestinoDaGaveta[]) => DestinoDaGaveta[],
): DestinoDaGaveta[] {
  const todos = destinosDe(categoria);
  return (ordenar ? ordenar(todos) : todos).slice(0, quantos);
}

// ── a busca ─────────────────────────────────────────────────────────────────

/**
 * O rótulo partido em volta do trecho que casou com a busca.
 *
 * <p>Três pedaços e não HTML: o template monta o `<mark>` com interpolação, e
 * nada que venha do menu passa por `innerHTML`.
 */
export interface TrechosDoRotulo {
  antes: string;
  trecho: string;
  depois: string;
}

/** Uma linha da lista de resultados. */
export interface ResultadoDaBusca extends DestinoDaGaveta {
  /** Único na lista — "Eventos" existe em dois lugares, o caminho não. */
  breadcrumb: string;
  /** URL absoluta, para o Enter navegar sem passar pelo `routerLink`. */
  path: string;
  /**
   * Onde a tela mora, sem ela mesma: `RH › Aprovações`. Vazio numa folha de
   * primeiro nível, que não tem onde morar.
   */
  caminho: string;
  /** O mesmo sufixo de {@link CategoriaDaGaveta.cor}: o selo do caminho. */
  cor: string;
  rotulo: TrechosDoRotulo;
}

/**
 * Um item achado pelo `MenuService.search` virando linha da gaveta.
 *
 * <p>A busca em si NÃO mora aqui: é a mesma da topbar, e duas buscas
 * discordariam na primeira vez que uma delas mudasse. Aqui só se decide como o
 * resultado se desenha.
 *
 * <p>A raiz do caminho usa o {@link ROTULO_CURTO}, pela mesma razão do tile:
 * o cartão diz "RH", e o caminho dizer "RH - Recursos Humanos" faria a pessoa
 * procurar duas coisas diferentes.
 */
export function comoResultado(item: FlatMenuItem, busca: string): ResultadoDaBusca {
  const partes = item.breadcrumb.split(' › ');
  const raiz = partes[0];
  const acima = partes.slice(0, -1);

  if (acima.length > 0) acima[0] = ROTULO_CURTO[acima[0]] ?? acima[0];

  return {
    label: item.label,
    icon: item.icon,
    routerLink: item.routerLink,
    url: item.url,
    target: item.target,
    externo: !!item.url,
    breadcrumb: item.breadcrumb,
    path: item.path,
    caminho: acima.join(' › '),
    cor: COR_DA_CATEGORIA[idDe(raiz)] ?? '',
    rotulo: destacar(item.label, busca),
  };
}

/**
 * Parte o rótulo em volta do que foi digitado, <b>ignorando acento</b>.
 *
 * <p>A busca casa "ferias" com "Férias", então o destaque tem que casar
 * também: procura no texto dobrado e corta o original na mesma posição. Dá
 * certo porque dobrar tira o acento sem mudar o comprimento — "é" é uma letra
 * antes e depois. Se um dia não for (texto já decomposto vindo de fora), o
 * rótulo sai sem destaque, que é feio mas não é errado.
 *
 * <p>Casou só pelo caminho (buscar "estoque" acha "Produtos"): sem destaque,
 * o rótulo inteiro vai em `antes`.
 */
export function destacar(rotulo: string, busca: string): TrechosDoRotulo {
  const alvo = dobrarAcento(busca.trim());
  const dobrado = dobrarAcento(rotulo);
  const inicio = alvo && dobrado.length === rotulo.length ? dobrado.indexOf(alvo) : -1;

  if (inicio === -1) return { antes: rotulo, trecho: '', depois: '' };

  const fim = inicio + alvo.length;

  return {
    antes: rotulo.slice(0, inicio),
    trecho: rotulo.slice(inicio, fim),
    depois: rotulo.slice(fim),
  };
}

// ── por dentro ──────────────────────────────────────────────────────────────

function ehGrupo(item: AppMenuItem): boolean {
  return !!item.items && item.items.length > 0;
}

function comoFolha(item: AppMenuItem): CategoriaDaGaveta {
  return {
    id: idDe(item.label),
    label: ROTULO_CURTO[item.label] ?? item.label,
    labelCompleto: item.label,
    icon: item.icon,
    tipo: 'folha',
    destino: comoDestino(item),
    secoes: [],
    total: 1,
    cor: COR_DA_CATEGORIA[idDe(item.label)] ?? '',
  };
}

/**
 * A categoria com filhos.
 *
 * <p><b>Aqui mora a resposta do RH.</b> Filho folha entra na primeira seção,
 * sem cabeçalho; filho grupo vira uma seção com o nome dele. Neto de grupo é
 * achatado na seção do pai — não existe hoje, e se aparecer amanhã continua
 * alcançável em vez de sumir calado. O `menu.config.spec` é quem avisa.
 *
 * <p>Não achatar tudo numa lista só tem razão concreta: existe `Comunicação` no
 * primeiro nível <b>e</b> dentro do RH. Soltos lado a lado, "Mural de Avisos" e
 * "Notificações" ficariam sem nada dizendo que são a comunicação do RH.
 */
function comoPasta(item: AppMenuItem): CategoriaDaGaveta {
  const filhos = item.items ?? [];

  const soltas = filhos.filter(filho => !ehGrupo(filho)).map(comoDestino);

  const secoes: SecaoDaPasta[] = [];

  if (soltas.length > 0) {
    secoes.push({ titulo: null, itens: soltas });
  }

  for (const filho of filhos.filter(ehGrupo)) {
    secoes.push({ titulo: filho.label, itens: achatar(filho) });
  }

  return {
    id: idDe(item.label),
    label: ROTULO_CURTO[item.label] ?? item.label,
    labelCompleto: item.label,
    icon: item.icon,
    tipo: 'pasta',
    secoes,
    total: secoes.reduce((soma, secao) => soma + secao.itens.length, 0),
    cor: COR_DA_CATEGORIA[idDe(item.label)] ?? '',
  };
}

/** Tudo que é folha abaixo deste nó, em profundidade. */
function achatar(grupo: AppMenuItem): DestinoDaGaveta[] {
  return (grupo.items ?? []).flatMap(filho =>
    ehGrupo(filho) ? achatar(filho) : [comoDestino(filho)]);
}

function comoDestino(item: AppMenuItem): DestinoDaGaveta {
  return {
    label: item.label,
    icon: item.icon,
    routerLink: item.routerLink,
    url: item.url,
    target: item.target,
    externo: !!item.url,
  };
}

/** Minúsculas, sem acento e com hífen: vai para o `track` e para a URL. */
function idDe(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
