// ═══════════════════════════════════════════════════════════════════════════
// Onde o app está rodando, do ponto de vista de instalar
//
// Função pura: recebe o que o navegador diz e devolve qual convite mostrar.
// Fica separada do serviço porque é a única parte com regra de verdade — o
// resto é escutar evento e guardar sinal.
// ═══════════════════════════════════════════════════════════════════════════

export type PlataformaDeInstalacao = 'instalado' | 'ios' | 'android' | 'desktop';

export interface SinaisDoNavegador {
  userAgent: string;
  /**
   * `matchMedia('(display-mode: standalone)').matches`.
   *
   * Funciona no Android e no desktop. **No iOS não** — o Safari só expõe o
   * `navigator.standalone` abaixo, e é por isso que os dois são consultados.
   */
  displayStandalone: boolean;
  /** `navigator.standalone` — só existe no Safari, e é o único sinal do iPhone. */
  navigatorStandalone: boolean | undefined;
}

/**
 * `instalado` vem primeiro de propósito: quem já instalou não pode ver convite
 * nenhum, e a checagem de plataforma não deve nem ser consultada.
 */
export function detectarPlataforma(sinais: SinaisDoNavegador): PlataformaDeInstalacao {
  if (sinais.displayStandalone || sinais.navigatorStandalone === true) return 'instalado';

  const ua = sinais.userAgent;

  // O iPad moderno se apresenta como Macintosh, e a única diferença é ter
  // toque. Sem esta parte, um iPad em Safari cairia em `desktop` e receberia
  // um convite que não existe naquele navegador.
  const ehIpadNovo = /Macintosh/.test(ua) && /Mobile|Tablet/.test(ua);
  if (/iPhone|iPad|iPod/.test(ua) || ehIpadNovo) return 'ios';

  if (/Android/.test(ua)) return 'android';

  return 'desktop';
}

/**
 * O iPhone tem UM caminho de instalação, e ele é do Safari.
 *
 * Chrome, Firefox e Edge no iOS são o WebKit por dentro, mas nenhum deles tem
 * "Adicionar à Tela de Início" no menu de compartilhar. Mandar o passo a passo
 * do Safari para quem está no Chrome é pior que não mandar nada: a pessoa
 * procura um botão que não existe e conclui que não dá.
 */
export function ehSafariNoIos(userAgent: string): boolean {
  const outrosNavegadores = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/;
  return !outrosNavegadores.test(userAgent);
}
