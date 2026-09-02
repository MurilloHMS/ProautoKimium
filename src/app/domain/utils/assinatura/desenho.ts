// ═══════════════════════════════════════════════════════════════════════════
// O desenho da assinatura
//
// Traduz o template numa lista de operações de texto. Não toca no canvas e não
// conhece nenhum: recebe uma função de medição e devolve coordenadas.
//
// É essa separação que faz o editor e o PNG serem a mesma coisa — as duas
// telas chamam esta função, então não existe um segundo desenho para discordar
// do primeiro. E é o que torna a parte difícil testável sem navegador.
// ═══════════════════════════════════════════════════════════════════════════

import type { CampoDoTemplate, TemplateDeAssinatura } from '../../models/assinatura-template.model';

export interface Metricas {
  largura: number;
  /**
   * A altura da CAIXA da fonte, e não a da tinta do texto.
   *
   * Quem implementar tem que usar `fontBoundingBoxAscent`. Com
   * `actualBoundingBoxAscent` o valor muda conforme as letras: "acme" não tem
   * ascendente e "Acme" tem, então o texto pula verticalmente enquanto se
   * digita. Parece defeito de renderização e leva horas para diagnosticar.
   */
  ascent: number;
}

export type Medidor = (texto: string, fonte: string) => Metricas;

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface OperacaoDeTexto {
  texto: string;
  x: number;
  /** A baseline, que é o que o `fillText` do canvas espera. */
  y: number;
  /** Pronta para `ctx.font`. */
  fonte: string;
  cor: string;
  alinhamento: CanvasTextAlign;
  /** Só em `CORTAR`; nos outros modos o texto já foi feito caber. */
  recorte: Retangulo | null;
}

/** Abaixo disto o texto deixa de ser legível, e encolher mais não ajuda ninguém. */
const PISO_DE_ENCOLHIMENTO = 0.6;

/** De quanto em quanto o tamanho cai ao procurar o que cabe. */
const PASSO_DE_ENCOLHIMENTO = 0.5;

export function fonteCss(campo: CampoDoTemplate, tamanho = campo.tamanho): string {
  const italico = campo.italico ? 'italic ' : '';
  return `${italico}${campo.peso} ${tamanho}px "${campo.fonte}", sans-serif`;
}

/**
 * Quebra gulosa: acumula palavras enquanto couberem.
 *
 * Uma palavra maior que a caixa sai sozinha na linha e transborda. É de
 * propósito — parti-la no meio esconderia o problema, e o laço que tentasse
 * caber o incaível nunca terminaria.
 */
export function quebrarLinhas(
  medir: Medidor,
  texto: string,
  fonte: string,
  largura: number,
): string[] {
  const linhas: string[] = [];

  for (const paragrafo of texto.split('\n')) {
    const palavras = paragrafo.split(' ').filter(p => p.length > 0);
    if (palavras.length === 0) {
      linhas.push('');
      continue;
    }

    let atual = palavras[0];
    for (const palavra of palavras.slice(1)) {
      const tentativa = `${atual} ${palavra}`;
      if (medir(tentativa, fonte).largura <= largura) {
        atual = tentativa;
      } else {
        linhas.push(atual);
        atual = palavra;
      }
    }
    linhas.push(atual);
  }

  return linhas;
}

/**
 * O maior tamanho, do nominal para baixo, em que o texto cabe numa linha.
 *
 * Para no piso mesmo sem caber: é o que uma assinatura quer — um cargo de
 * quarenta caracteres diminui em vez de invadir a arte, mas não vira formiga.
 */
export function encolherParaCaber(
  medir: Medidor,
  texto: string,
  campo: CampoDoTemplate,
): number {
  const minimo = campo.tamanho * PISO_DE_ENCOLHIMENTO;
  let tamanho = campo.tamanho;

  while (tamanho > minimo && medir(texto, fonteCss(campo, tamanho)).largura > campo.largura) {
    tamanho -= PASSO_DE_ENCOLHIMENTO;
  }

  return Math.max(tamanho, minimo);
}

/** As operações de um campo. Vazio quando não há valor: caixa sem texto não desenha nada. */
export function operacoesDoCampo(
  campo: CampoDoTemplate,
  valor: string,
  medir: Medidor,
): OperacaoDeTexto[] {
  const texto = valor.trim();
  if (!texto) return [];

  const tamanho = campo.estouro === 'ENCOLHER' ? encolherParaCaber(medir, texto, campo) : campo.tamanho;
  const fonte = fonteCss(campo, tamanho);

  const linhas = campo.estouro === 'QUEBRAR'
    ? quebrarLinhas(medir, texto, fonte, campo.largura)
    : [texto];

  const alturaDaLinha = tamanho * campo.alturaDaLinha;
  const alturaDoBloco = linhas.length * alturaDaLinha;

  const topo = inicioVertical(campo, alturaDoBloco);
  const { x, alinhamento } = ancoraHorizontal(campo);

  // O ascent vem de uma medição só, e não de cada linha: medido por linha, ele
  // mudaria com as letras de cada uma e as linhas ficariam desalinhadas entre si.
  const { ascent } = medir(texto, fonte);

  const recorte: Retangulo | null = campo.estouro === 'CORTAR'
    ? { x: campo.x, y: campo.y, largura: campo.largura, altura: campo.altura }
    : null;

  return linhas.map((linha, i) => ({
    texto: linha,
    x,
    y: topo + ascent + i * alturaDaLinha,
    fonte,
    cor: campo.cor,
    alinhamento,
    recorte,
  }));
}

/**
 * Todas as operações do template, na ordem de empilhamento.
 *
 * `valores` é indexado por `chave`. Campo sem valor simplesmente não aparece.
 */
export function operacoesDoTemplate(
  template: TemplateDeAssinatura,
  valores: Record<string, string>,
  medir: Medidor,
): OperacaoDeTexto[] {
  return [...template.campos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap(campo => operacoesDoCampo(campo, valores[campo.chave] ?? '', medir));
}

function inicioVertical(campo: CampoDoTemplate, alturaDoBloco: number): number {
  switch (campo.alinhamentoVertical) {
    case 'MEIO': return campo.y + (campo.altura - alturaDoBloco) / 2;
    case 'BASE': return campo.y + campo.altura - alturaDoBloco;
    default:     return campo.y;
  }
}

/**
 * O `textAlign` do canvas é relativo à coordenada que se passa, e não a caixa
 * nenhuma — então o x muda junto com o modo. Esquecer de mover o x é o defeito
 * clássico aqui, e ele fica "quase certo": só aparece em caixa larga.
 */
function ancoraHorizontal(campo: CampoDoTemplate): { x: number; alinhamento: CanvasTextAlign } {
  switch (campo.alinhamento) {
    case 'CENTRO':  return { x: campo.x + campo.largura / 2, alinhamento: 'center' };
    case 'DIREITA': return { x: campo.x + campo.largura,     alinhamento: 'right' };
    default:        return { x: campo.x,                     alinhamento: 'left' };
  }
}
