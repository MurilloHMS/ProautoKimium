/**
 * O layout do Guia de Utilização — o mesmo documento que a API guarda em
 * `guide_layouts.document` e o Jasper desenha.
 *
 * Medidas em pontos (1/72"), as do PDF. Posições do cabeçalho e do rodapé são
 * relativas à área útil, dentro das margens.
 *
 * O formato é da API (`GuideLayoutDocument.java`). Mudou lá, muda aqui.
 */
export interface GuideLayoutDocument {
  page: GuidePage;
  header: GuideBand;
  table: GuideTable;
  footer: GuideBand;
}

export type PageFormat = 'LETTER' | 'A4';
export type PageOrientation = 'LANDSCAPE' | 'PORTRAIT';
export type HAlign = 'LEFT' | 'CENTER' | 'RIGHT';
export type VAlign = 'TOP' | 'MIDDLE' | 'BOTTOM';
export type ElementType = 'TEXT' | 'IMAGE' | 'RECTANGLE' | 'LINE';

export interface GuidePage {
  format: PageFormat;
  orientation: PageOrientation;
  margins: { top: number; bottom: number; left: number; right: number };
  font: string;
}

export interface GuideBand {
  height: number;
  elements: GuideElement[];
}

/** Só os campos do tipo valem; os outros viajam nulos. */
export interface GuideElement {
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string | null;
  fontSize?: number | null;
  bold?: boolean | null;
  color?: string | null;
  align?: HAlign | null;
  verticalAlign?: VAlign | null;
  image?: string | null;
  imageId?: string | null;
}

export interface GuideTable {
  headerBackground: string;
  headerColor: string;
  headerFontSize: number;
  headerHeight: number;
  minRowHeight: number;
  dividerColor: string;
  separatorColor: string;
  columns: GuideColumn[];
}

export interface GuideColumn {
  title: string;
  width: number;
  paddingTop: number;
  blocks: GuideBlock[];
}

/** `field` é uma chave do catálogo da API (`GuideField`). */
export interface GuideBlock {
  field: string;
  height: number;
  fontSize: number;
  bold: boolean;
  uppercase: boolean;
  align: HAlign;
  verticalAlign: VAlign;
  color: string;
  count?: number | null;
}

export type GuideLayoutStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface GuideLayoutVersion {
  id: string;
  status: GuideLayoutStatus;
  version: number | null;
  document: GuideLayoutDocument;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface GuideLayoutState {
  published: GuideLayoutVersion;
  draft: GuideLayoutVersion | null;
}

export interface GuideLayoutVersionSummary {
  id: string;
  version: number;
  note: string | null;
  publishedAt: string;
  publishedBy: string | null;
  current: boolean;
}

export type GuideFieldKind = 'TEXT' | 'IMAGE' | 'IMAGE_LIST';

/** O que o editor pode oferecer. Vem da API: o site não tem lista própria. */
export interface GuideLayoutCatalog {
  fields: { key: string; label: string; kind: GuideFieldKind }[];
  imageSources: { key: string; label: string }[];
  fonts: string[];
}

/** O que está selecionado na página do editor. */
export type GuideSelection =
  | { kind: 'page' }
  | { kind: 'element'; band: 'header' | 'footer'; index: number }
  | { kind: 'column'; index: number; block: number | null };
