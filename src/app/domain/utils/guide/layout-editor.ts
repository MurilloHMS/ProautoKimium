import type {
  ElementType, GuideBand, GuideBlock, GuideColumn, GuideElement, GuideFieldKind,
  GuideLayoutDocument, GuidePage,
} from '../../models/guide-layout.model';

/**
 * As contas do editor do guia, sem DOM e sem Angular.
 *
 * Tudo devolve um layout NOVO: o componente guarda o layout num signal, e
 * mutar o objeto por dentro não avisaria ninguém.
 *
 * As contas de página espelham `GuidePageSize.java`. Se uma mudar sem a outra,
 * o editor aceita um layout que a API recusa ao salvar.
 */

export interface PageSize {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
}

/** Espaço entre um bloco e o de baixo, dentro da célula — o mesmo do PDF. */
export const BLOCK_GAP = 2;

export function pageSize(page: GuidePage): PageSize {
  const a4 = page.format === 'A4';
  const short = a4 ? 595 : 612;
  const long = a4 ? 842 : 792;
  const landscape = page.orientation !== 'PORTRAIT';
  const width = landscape ? long : short;
  const height = landscape ? short : long;
  const m = page.margins;
  return { width, height, contentWidth: width - m.left - m.right, contentHeight: height - m.top - m.bottom };
}

export function columnsTotal(layout: GuideLayoutDocument): number {
  return layout.table.columns.reduce((sum, c) => sum + c.width, 0);
}

/** Quanto falta (negativo) ou sobra (positivo) de largura para as colunas. */
export function widthLeft(layout: GuideLayoutDocument): number {
  return pageSize(layout.page).contentWidth - columnsTotal(layout);
}

/** A altura que a coluna ocupa antes de qualquer texto esticar (`stackHeight` no Java). */
export function stackHeight(column: GuideColumn): number {
  const blocks = column.blocks.reduce((sum, b) => sum + b.height, 0);
  return column.paddingTop + blocks + BLOCK_GAP * Math.max(0, column.blocks.length - 1);
}

export function rowHeight(layout: GuideLayoutDocument): number {
  return Math.max(layout.table.minRowHeight, ...layout.table.columns.map(stackHeight));
}

/** O topo de cada bloco dentro da célula. */
export function blockTops(column: GuideColumn): number[] {
  let y = column.paddingTop;
  return column.blocks.map(b => {
    const top = y;
    y += b.height + BLOCK_GAP;
    return top;
  });
}

// ── Cabeçalho e rodapé ────────────────────────────────────────────────────

export type BandKey = 'header' | 'footer';

/** Prende o item dentro da faixa: arrastar para fora seria recusado ao salvar. */
export function clampElement(element: GuideElement, band: GuideBand, contentWidth: number): GuideElement {
  const width = Math.max(1, Math.min(Math.round(element.width), contentWidth));
  const height = Math.max(1, Math.min(Math.round(element.height), band.height));
  return {
    ...element,
    width,
    height,
    x: Math.max(0, Math.min(Math.round(element.x), contentWidth - width)),
    y: Math.max(0, Math.min(Math.round(element.y), band.height - height)),
  };
}

export function updateElement(
  layout: GuideLayoutDocument, band: BandKey, index: number, patch: Partial<GuideElement>,
): GuideLayoutDocument {
  const current = layout[band];
  const contentWidth = pageSize(layout.page).contentWidth;
  const elements = current.elements.map((e, i) =>
    i === index ? clampElement({ ...e, ...patch }, current, contentWidth) : e);
  return { ...layout, [band]: { ...current, elements } };
}

export function addElement(layout: GuideLayoutDocument, band: BandKey, type: ElementType): GuideLayoutDocument {
  const base = { x: 8, y: 4, color: '#1A3A5C' };
  const fresh: GuideElement =
    type === 'TEXT' ? { ...base, type, width: 160, height: 14, text: 'Novo texto', fontSize: 8, bold: true, align: 'LEFT', verticalAlign: 'MIDDLE' }
    : type === 'IMAGE' ? { type, x: 8, y: 4, width: 40, height: 32, image: 'COMPANY_LOGO', align: 'CENTER' }
    : type === 'LINE' ? { ...base, type, width: 120, height: 1, color: '#CCCCCC' }
    : { ...base, type, width: 120, height: 10 };
  const current = layout[band];
  const clamped = clampElement(fresh, current, pageSize(layout.page).contentWidth);
  return { ...layout, [band]: { ...current, elements: [...current.elements, clamped] } };
}

export function removeElement(layout: GuideLayoutDocument, band: BandKey, index: number): GuideLayoutDocument {
  const current = layout[band];
  return { ...layout, [band]: { ...current, elements: current.elements.filter((_, i) => i !== index) } };
}

// ── Colunas ───────────────────────────────────────────────────────────────

export const MIN_COLUMN_WIDTH = 10;

export function updateColumn(layout: GuideLayoutDocument, index: number, patch: Partial<GuideColumn>): GuideLayoutDocument {
  const columns = layout.table.columns.map((c, i) => {
    if (i !== index) return c;
    const next = { ...c, ...patch };
    return { ...next, width: Math.max(MIN_COLUMN_WIDTH, Math.round(next.width)) };
  });
  return { ...layout, table: { ...layout.table, columns } };
}

/** Tira a coluna `from` e a põe na posição `to`, contada depois da retirada. */
export function moveColumn(layout: GuideLayoutDocument, from: number, to: number): GuideLayoutDocument {
  const columns = [...layout.table.columns];
  if (from < 0 || from >= columns.length) return layout;
  const [moved] = columns.splice(from, 1);
  columns.splice(Math.max(0, Math.min(to, columns.length)), 0, moved);
  return { ...layout, table: { ...layout.table, columns } };
}

export function removeColumn(layout: GuideLayoutDocument, index: number): GuideLayoutDocument {
  return { ...layout, table: { ...layout.table, columns: layout.table.columns.filter((_, i) => i !== index) } };
}

/** Coluna nova com a largura que sobra — ou 60 pt, se não sobrar nada. */
export function addColumn(layout: GuideLayoutDocument): GuideLayoutDocument {
  const width = Math.max(60, widthLeft(layout));
  const column: GuideColumn = { title: 'NOVA COLUNA', width, paddingTop: 0, blocks: [] };
  return { ...layout, table: { ...layout.table, columns: [...layout.table.columns, column] } };
}

// ── Blocos da célula ──────────────────────────────────────────────────────

export function newBlock(field: string, kind: GuideFieldKind): GuideBlock {
  return kind === 'TEXT'
    ? { field, height: 14, fontSize: 7, bold: false, uppercase: false, align: 'CENTER', verticalAlign: 'MIDDLE', color: '#000000' }
    : { field, height: 30, fontSize: 7, bold: false, uppercase: false, align: 'CENTER', verticalAlign: 'MIDDLE', color: '#000000',
        count: kind === 'IMAGE_LIST' ? 1 : null };
}

function withBlocks(layout: GuideLayoutDocument, column: number, blocks: (b: GuideBlock[]) => GuideBlock[]): GuideLayoutDocument {
  const columns = layout.table.columns.map((c, i) => (i === column ? { ...c, blocks: blocks(c.blocks) } : c));
  return { ...layout, table: { ...layout.table, columns } };
}

export function addBlock(layout: GuideLayoutDocument, column: number, block: GuideBlock): GuideLayoutDocument {
  return withBlocks(layout, column, b => [...b, block]);
}

export function updateBlock(layout: GuideLayoutDocument, column: number, index: number, patch: Partial<GuideBlock>): GuideLayoutDocument {
  return withBlocks(layout, column, b => b.map((x, i) => (i === index ? { ...x, ...patch, height: Math.max(1, Math.round(patch.height ?? x.height)) } : x)));
}

export function removeBlock(layout: GuideLayoutDocument, column: number, index: number): GuideLayoutDocument {
  return withBlocks(layout, column, b => b.filter((_, i) => i !== index));
}

/** Troca o bloco com o vizinho: `-1` sobe, `+1` desce. Fora dos limites, nada muda. */
export function shiftBlock(layout: GuideLayoutDocument, column: number, index: number, direction: -1 | 1): GuideLayoutDocument {
  const target = index + direction;
  return withBlocks(layout, column, b => {
    if (target < 0 || target >= b.length) return b;
    const next = [...b];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
}

// ── Página ────────────────────────────────────────────────────────────────

export function updatePage(layout: GuideLayoutDocument, patch: Partial<GuidePage>): GuideLayoutDocument {
  return { ...layout, page: { ...layout.page, ...patch } };
}

/**
 * O que o validador da API vai recusar, na mesma frase — para o editor avisar
 * ANTES de salvar, e travar o Publicar. A API continua sendo a palavra final.
 */
export function layoutProblems(layout: GuideLayoutDocument): string[] {
  const problems: string[] = [];
  const size = pageSize(layout.page);
  const left = widthLeft(layout);
  if (left < 0) {
    problems.push(`As colunas somam ${columnsTotal(layout)} pt e a página tem ${size.contentWidth} pt de largura útil. Tire ${-left} pt de alguma coluna`);
  }
  if (layout.table.columns.length === 0) problems.push('A tabela precisa de pelo menos uma coluna');
  const fixed = layout.header.height + layout.table.headerHeight + layout.table.minRowHeight + 1 + layout.footer.height;
  if (fixed > size.contentHeight) {
    problems.push(`Cabeçalho, título da tabela, uma linha e rodapé somam ${fixed} pt, e a página tem ${size.contentHeight} pt de altura útil`);
  }
  for (const band of ['header', 'footer'] as const) {
    layout[band].elements.forEach((e, i) => {
      if (e.x + e.width > size.contentWidth || e.y + e.height > layout[band].height) {
        problems.push(`Item ${i + 1} do ${band === 'header' ? 'cabeçalho' : 'rodapé'}: está fora da faixa`);
      }
    });
  }
  return problems;
}
