// ═══════════════════════════════════════════════════════════════════════════
// A edição do template
//
// As contas do editor, sem DOM e sem canvas: converter ponteiro em coordenada,
// prender o campo dentro da tela, criar campo novo e recusar chave repetida.
// ═══════════════════════════════════════════════════════════════════════════

import type { CampoDoTemplate, CanvasDoTemplate } from '../../models/assinatura-template.model';

export interface Retangulo {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Ponto {
  x: number;
  y: number;
}

/**
 * Converte a posição do ponteiro em coordenada do template.
 *
 * Usa o retângulo do canvas, e nunca `event.offsetX`: `offsetX` é relativo ao
 * ALVO do evento, que muda conforme o ponteiro está sobre o canvas ou sobre
 * uma alça por cima dele. O sintoma é o campo pulando ao começar o arraste
 * justamente em cima da alça — que é onde todo mundo começa.
 */
export function pontoNoTemplate(
  clienteX: number,
  clienteY: number,
  area: Retangulo,
  canvas: CanvasDoTemplate,
): Ponto {
  const escalaX = canvas.largura / area.width;
  const escalaY = canvas.altura / area.height;

  return {
    x: (clienteX - area.left) * escalaX,
    y: (clienteY - area.top) * escalaY,
  };
}

/**
 * Prende o campo dentro da tela.
 *
 * Deixa sempre uma parte visível: um campo arrastado inteiro para fora vira
 * um campo que ninguém consegue selecionar de novo, porque não há o que
 * clicar. O canto superior esquerdo é o que se limita.
 */
export function prenderNaTela(campo: CampoDoTemplate, canvas: CanvasDoTemplate): CampoDoTemplate {
  return {
    ...campo,
    x: Math.round(Math.min(Math.max(campo.x, 0), canvas.largura - campo.largura)),
    y: Math.round(Math.min(Math.max(campo.y, 0), canvas.altura - campo.altura)),
  };
}

/** A chave é o contrato com o formulário de gerar: duas iguais quebram o par. */
export function chaveDisponivel(
  campos: CampoDoTemplate[],
  chave: string,
  idDoProprio: string,
): boolean {
  const limpa = chave.trim().toLowerCase();
  if (!limpa) return false;

  return !campos.some(c => c.id !== idDoProprio && c.chave.trim().toLowerCase() === limpa);
}

/**
 * Um campo novo, no meio da tela e com chave que ainda não existe.
 *
 * Nascer no meio é deliberado: no canto ele encosta na borda e o primeiro
 * arraste já esbarra no limite, o que parece defeito.
 */
export function campoNovo(campos: CampoDoTemplate[], canvas: CanvasDoTemplate): CampoDoTemplate {
  const largura = Math.min(280, canvas.largura - 40);
  const altura = 32;

  let numero = campos.length + 1;
  while (!chaveDisponivel(campos, `campo${numero}`, '')) numero++;

  return {
    id: crypto.randomUUID(),
    chave: `campo${numero}`,
    rotulo: `Campo ${numero}`,
    tipo: 'TEXTO',
    obrigatorio: false,
    exemplo: 'Texto de exemplo',
    x: Math.round((canvas.largura - largura) / 2),
    y: Math.round((canvas.altura - altura) / 2),
    largura,
    altura,
    fonte: campos[0]?.fonte ?? 'Montserrat',
    tamanho: 16,
    peso: 700,
    italico: false,
    cor: campos[0]?.cor ?? '#232E61',
    alinhamento: 'ESQUERDA',
    alinhamentoVertical: 'TOPO',
    alturaDaLinha: 1.2,
    estouro: 'ENCOLHER',
    ordem: campos.length,
  };
}

/**
 * Substitui um campo na lista, devolvendo lista nova.
 *
 * Nunca muta: o `computed` que ordena os campos e o `effect` que redesenha
 * dependem da identidade do array para saber que algo mudou.
 */
export function comCampoTrocado(
  campos: CampoDoTemplate[],
  trocado: CampoDoTemplate,
): CampoDoTemplate[] {
  return campos.map(c => (c.id === trocado.id ? trocado : c));
}

/** Remove e renumera a ordem, para não deixar buraco no empilhamento. */
export function semCampo(campos: CampoDoTemplate[], id: string): CampoDoTemplate[] {
  return campos
    .filter(c => c.id !== id)
    .sort((a, b) => a.ordem - b.ordem)
    .map((c, i) => ({ ...c, ordem: i }));
}
