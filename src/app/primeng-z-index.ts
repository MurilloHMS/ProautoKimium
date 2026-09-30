/**
 * Onde os painéis do PrimeNG começam a empilhar.
 *
 * Painel com `appendTo="body"` (calendário, lista do select, multiselect,
 * senha, cor) ganha o z-index **inline**, calculado pelo PrimeNG a partir
 * desta base — por isso um `z-index` no CSS não tem efeito nenhum sobre ele.
 * O padrão do PrimeNG é 1000, abaixo da `pk-sheet` (1050, 1060 empilhada) e da
 * gaveta (1100): no celular, a lista abria ATRÁS da folha que a chamou. O
 * primeiro relato foi o calendário do reembolso (2026-09-30), corrigido só
 * naquela tela com `[baseZIndex]`; aqui vale para todas.
 *
 * A escala do tema (`styles/variables.scss`): sticky 40, dropdown 100,
 * overlay 1000, pk-sheet 1050/1060, drawer 1100, modal 1200, toast 1300. Um
 * painel aberto é "o que está na mão": fica acima de tudo que o abriu (folha,
 * gaveta, diálogo) e abaixo do toast. Dentro de um p-dialog o próprio PrimeNG
 * soma as bases, então a lista continua acima do diálogo.
 */
export const PRIMENG_Z_INDEX = {
  modal: 1100,
  overlay: 1100,
  menu: 1100,
  tooltip: 1100,
};
