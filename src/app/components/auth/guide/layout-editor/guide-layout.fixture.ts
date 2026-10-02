import type { GuideLayoutCatalog, GuideLayoutDocument, GuideLayoutState } from '../../../../domain/models/guide-layout.model';

/** Um layout pequeno e válido: 680 pt de colunas numa Carta paisagem. */
export function fixtureLayout(): GuideLayoutDocument {
  return {
    page: { format: 'LETTER', orientation: 'LANDSCAPE', margins: { top: 40, bottom: 40, left: 56, right: 56 }, font: 'DejaVu Sans' },
    header: {
      height: 65,
      elements: [{ type: 'TEXT', x: 98, y: 12, width: 152, height: 40, text: 'GUIA DE UTILIZAÇÃO:', fontSize: 14, bold: true, color: '#1A3A5C', align: 'LEFT', verticalAlign: 'MIDDLE' }],
    },
    footer: { height: 55, elements: [{ type: 'RECTANGLE', x: 0, y: 0, width: 680, height: 38, color: '#232E61' }] },
    table: {
      headerBackground: '#232E61', headerColor: '#FFFFFF', headerFontSize: 6.5, headerHeight: 22, minRowHeight: 63,
      dividerColor: '#E0E4EA', separatorColor: '#DDDDDD',
      columns: [
        { title: 'PRODUTO', width: 113, paddingTop: 3, blocks: [
          { field: 'NAME', height: 13, fontSize: 6.5, bold: true, uppercase: true, align: 'CENTER', verticalAlign: 'MIDDLE', color: '#000000' },
        ] },
        { title: 'DILUIÇÃO', width: 567, paddingTop: 0, blocks: [
          { field: 'DILUTION', height: 63, fontSize: 7.5, bold: true, uppercase: false, align: 'CENTER', verticalAlign: 'MIDDLE', color: '#000000' },
        ] },
      ],
    },
  };
}

export function fixtureState(draft = false): GuideLayoutState {
  const version = {
    id: 'v3', status: 'PUBLISHED' as const, version: 3, document: fixtureLayout(), note: null,
    updatedAt: '2026-10-01T10:00:00', updatedBy: 'designer', publishedAt: '2026-10-01T10:00:00', publishedBy: 'designer',
  };
  return {
    published: version,
    draft: draft ? { ...version, id: 'd1', status: 'DRAFT', version: null, publishedAt: null, publishedBy: null } : null,
  };
}

export const FIXTURE_CATALOG: GuideLayoutCatalog = {
  fields: [
    { key: 'NAME', label: 'Nome do produto', kind: 'TEXT' },
    { key: 'DILUTION', label: 'Diluição', kind: 'TEXT' },
    { key: 'PHOTO', label: 'Foto do produto', kind: 'IMAGE' },
  ],
  imageSources: [{ key: 'COMPANY_LOGO', label: 'Logo da empresa' }],
  fonts: ['DejaVu Sans'],
};
