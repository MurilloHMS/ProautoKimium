// ═══════════════════════════════════════════════════════════════════════════
// O template da assinatura de e-mail
//
// É a tradução do que o `email_signature.jrxml` sempre foi: uma arte de fundo
// e caixas de texto em posição absoluta. A diferença é que agora mora no banco
// e o Design edita pela tela, em vez de o layout exigir redeploy.
//
// Os nomes dos campos são portugueses porque este documento é contrato
// gravado — o `EmailSignatureDTO` da API já fala `nome` e `cargo`, e o próprio
// designer lê estes nomes no painel de propriedades.
// ═══════════════════════════════════════════════════════════════════════════

/** Escolhe o controle e o validador do formulário de gerar. */
export type TipoDeCampo = 'TEXTO' | 'EMAIL' | 'TELEFONE' | 'URL';

export type Alinhamento = 'ESQUERDA' | 'CENTRO' | 'DIREITA';
export type AlinhamentoVertical = 'TOPO' | 'MEIO' | 'BASE';

/**
 * O que fazer com texto que não cabe na caixa.
 *
 * O jrxml de hoje corta em silêncio, e ninguém percebe porque "João Silva"
 * cabe. Num editor livre as caixas ficam apertadas com muito mais frequência,
 * então a política precisa ser escolhida por campo — e não herdada de um
 * padrão que ninguém viu.
 */
export type Estouro = 'ENCOLHER' | 'QUEBRAR' | 'CORTAR';

/** Como a arte de fundo ocupa a tela. */
export type AjusteDoFundo = 'ORIGINAL' | 'PREENCHER';

export interface CampoDoTemplate {
  /** Estável, nunca exibido. É o `track` da lista e a identidade na seleção. */
  id: string;

  /**
   * O nome que o designer dá, e a chave do valor no formulário de gerar.
   *
   * Separada do `id` de propósito: renomear a chave muda o contrato com quem
   * gera, e é uma decisão. Trocar o rótulo, não.
   */
  chave: string;

  /** O que o formulário mostra ao lado do campo. */
  rotulo: string;

  tipo: TipoDeCampo;
  obrigatorio: boolean;

  /**
   * O texto que aparece no editor no lugar do valor real.
   *
   * Não é enfeite: sem ele o designer posiciona caixas contra strings vazias e
   * não enxerga nada. É também onde se testa estouro — pondo aqui o nome
   * realista mais longo da empresa.
   */
  exemplo: string;

  x: number;
  y: number;
  largura: number;
  altura: number;

  fonte: string;
  tamanho: number;
  peso: number;
  italico: boolean;
  cor: string;

  alinhamento: Alinhamento;
  alinhamentoVertical: AlinhamentoVertical;

  /**
   * O canvas não tem `line-height`, então o valor é obrigatório aqui.
   *
   * Deixar o navegador decidir não é opção — não há navegador nenhum no
   * caminho do desenho.
   */
  alturaDaLinha: number;

  estouro: Estouro;

  /** Serve de ordem no formulário e de empilhamento no desenho. */
  ordem: number;
}

export interface FundoDoTemplate {
  /** Nulo quer dizer a arte que vem no bundle do site. */
  caminho: string | null;
  ajuste: AjusteDoFundo;
}

export interface CanvasDoTemplate {
  largura: number;
  altura: number;
  corDeFundo: string;
  fundo: FundoDoTemplate;
}

export interface TemplateDeAssinatura {
  versao: number;
  canvas: CanvasDoTemplate;
  campos: CampoDoTemplate[];
}

/** O que a API devolve: o documento como texto, mais o rastro de quem salvou. */
export interface RespostaDeTemplate {
  document: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** O que a API devolve ao receber uma arte de fundo. */
export interface RespostaDeFundo {
  path: string;
  width: number;
  height: number;
}
