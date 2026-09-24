import { AppMenuItem } from '../menu.config';

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
