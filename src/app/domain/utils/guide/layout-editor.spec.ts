import type { GuideLayoutDocument } from '../../models/guide-layout.model';
import {
  addColumn, addElement, blockTops, clampElement, columnsTotal, layoutProblems, moveColumn, newBlock,
  pageSize, removeColumn, rowHeight, shiftBlock, updateColumn, updateElement, widthLeft, addBlock,
} from './layout-editor';

/** Um recorte da semente da V115: as medidas que as contas usam. */
function layout(): GuideLayoutDocument {
  return {
    page: { format: 'LETTER', orientation: 'LANDSCAPE', margins: { top: 40, bottom: 40, left: 56, right: 56 }, font: 'DejaVu Sans' },
    header: { height: 65, elements: [{ type: 'IMAGE', x: 4, y: 5, width: 80, height: 52, image: 'COMPANY_LOGO' }] },
    footer: { height: 55, elements: [] },
    table: {
      headerBackground: '#232E61', headerColor: '#FFFFFF', headerFontSize: 6.5, headerHeight: 22, minRowHeight: 63,
      dividerColor: '#E0E4EA', separatorColor: '#DDDDDD',
      columns: [
        { title: 'PRODUTO', width: 69, paddingTop: 3, blocks: [newBlock('NAME', 'TEXT'), newBlock('PHOTO', 'IMAGE')] },
        { title: 'CÓDIGO', width: 44, paddingTop: 0, blocks: [{ ...newBlock('CODE', 'TEXT'), height: 63 }] },
        { title: 'RESTO', width: 567, paddingTop: 0, blocks: [] },
      ],
    },
  };
}

describe('layout-editor · as contas do editor do guia', () => {

  it('Carta paisagem com as margens da semente dá 680 × 532 pt de área útil', () => {
    expect(pageSize(layout().page)).toEqual({ width: 792, height: 612, contentWidth: 680, contentHeight: 532 });
  });

  it('A4 retrato troca os lados', () => {
    const size = pageSize({ ...layout().page, format: 'A4', orientation: 'PORTRAIT' });
    expect([size.width, size.height]).toEqual([595, 842]);
  });

  it('a semente usa a largura inteira, sem sobra nem falta', () => {
    expect(columnsTotal(layout())).toBe(680);
    expect(widthLeft(layout())).toBe(0);
    expect(layoutProblems(layout())).toEqual([]);
  });

  it('coluna larga demais vira a frase que a API diria, com quanto tirar', () => {
    const wide = updateColumn(layout(), 0, { width: 94 });
    expect(layoutProblems(wide)[0]).toContain('Tire 25 pt');
  });

  it('tirar uma coluna devolve a largura dela como sobra', () => {
    expect(widthLeft(removeColumn(layout(), 1))).toBe(44);
  });

  it('coluna nova nasce com a sobra, ou 60 pt quando não sobra nada', () => {
    const withRoom = addColumn(removeColumn(layout(), 2));
    expect(withRoom.table.columns.at(-1)!.width).toBe(567);
    expect(addColumn(layout()).table.columns.at(-1)!.width).toBe(60);
  });

  it('largura de coluna não cai abaixo do mínimo, nem com arraste exagerado', () => {
    expect(updateColumn(layout(), 0, { width: -40 }).table.columns[0].width).toBe(10);
  });

  it('mover a coluna 0 para o fim mantém as outras na ordem', () => {
    const moved = moveColumn(layout(), 0, 2);
    expect(moved.table.columns.map(c => c.title)).toEqual(['CÓDIGO', 'RESTO', 'PRODUTO']);
  });

  it('subir o bloco troca com o de cima; no topo, nada muda', () => {
    const swapped = shiftBlock(layout(), 0, 1, -1);
    expect(swapped.table.columns[0].blocks.map(b => b.field)).toEqual(['PHOTO', 'NAME']);
    expect(shiftBlock(layout(), 0, 0, -1)).toEqual(layout());
  });

  it('os blocos empilham com o respiro do topo e 2 pt entre eles, como no PDF', () => {
    expect(blockTops(layout().table.columns[0])).toEqual([3, 3 + 14 + 2]);
  });

  it('a linha cresce quando a pilha da coluna passa da altura mínima', () => {
    const tall = addBlock(layout(), 0, { ...newBlock('DESCRIPTION', 'TEXT'), height: 40 });
    // 3 + 14 + 2 + 30 + 2 + 40 = 91
    expect(rowHeight(tall)).toBe(91);
  });

  it('arrastar um item para fora da faixa o prende na borda, em vez de deixá-lo sumir', () => {
    const moved = updateElement(layout(), 'header', 0, { x: 900, y: -20 });
    const logo = moved.header.elements[0];
    expect([logo.x, logo.y]).toEqual([680 - 80, 0]);
  });

  it('item mais alto que a faixa encolhe para caber', () => {
    expect(clampElement({ type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 200 }, { height: 55, elements: [] }, 680).height).toBe(55);
  });

  it('item novo entra dentro da faixa, mesmo numa faixa baixa', () => {
    const low = { ...layout(), footer: { height: 10, elements: [] } };
    const added = addElement(low, 'footer', 'IMAGE').footer.elements[0];
    expect(added.y + added.height).toBeLessThanOrEqual(10);
  });

  it('nada é mutado: o layout original continua igual', () => {
    const original = layout();
    const snapshot = JSON.stringify(original);
    moveColumn(original, 0, 2);
    updateElement(original, 'header', 0, { x: 100 });
    shiftBlock(original, 0, 1, -1);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
