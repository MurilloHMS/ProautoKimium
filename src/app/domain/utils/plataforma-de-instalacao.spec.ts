import { detectarPlataforma, ehSafariNoIos, type SinaisDoNavegador } from './plataforma-de-instalacao';

/** User agents reais, copiados de aparelhos, e nao inventados. */
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  ipadNovo: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

function sinais(ajustes: Partial<SinaisDoNavegador> = {}): SinaisDoNavegador {
  return {
    userAgent: UA.windowsChrome,
    displayStandalone: false,
    navigatorStandalone: undefined,
    ...ajustes,
  };
}

describe('detectarPlataforma', () => {

  it('reconhece iPhone, Android e computador', () => {
    expect(detectarPlataforma(sinais({ userAgent: UA.iphoneSafari }))).toBe('ios');
    expect(detectarPlataforma(sinais({ userAgent: UA.androidChrome }))).toBe('android');
    expect(detectarPlataforma(sinais({ userAgent: UA.windowsChrome }))).toBe('desktop');
    expect(detectarPlataforma(sinais({ userAgent: UA.mac }))).toBe('desktop');
  });

  it('reconhece o iPad novo, que se apresenta como Macintosh', () => {
    // Sem tratar este caso, um iPad em Safari cairia em 'desktop' e receberia
    // um convite de instalar que naquele navegador nao existe.
    expect(detectarPlataforma(sinais({ userAgent: UA.ipadNovo }))).toBe('ios');
  });

  it('diz instalado quando o display-mode e standalone', () => {
    expect(detectarPlataforma(sinais({
      userAgent: UA.androidChrome, displayStandalone: true,
    }))).toBe('instalado');
  });

  it('diz instalado no iPhone pelo navigator.standalone', () => {
    // E o UNICO sinal que o iOS da: `display-mode: standalone` nao funciona la,
    // entao um iPhone ja instalado apareceria como 'ios' e receberia de novo o
    // passo a passo de instalar - justamente para quem ja instalou.
    expect(detectarPlataforma(sinais({
      userAgent: UA.iphoneSafari, displayStandalone: false, navigatorStandalone: true,
    }))).toBe('instalado');
  });

  it('nao confunde navigator.standalone falso com instalado', () => {
    // O Safari define a propriedade como `false` numa aba normal. Testar so a
    // existencia dela marcaria todo iPhone como instalado.
    expect(detectarPlataforma(sinais({
      userAgent: UA.iphoneSafari, navigatorStandalone: false,
    }))).toBe('ios');
  });

  it('instalado vence a plataforma', () => {
    expect(detectarPlataforma(sinais({
      userAgent: UA.iphoneSafari, displayStandalone: true,
    }))).toBe('instalado');
  });
});

describe('ehSafariNoIos', () => {

  it('aceita o Safari', () => {
    expect(ehSafariNoIos(UA.iphoneSafari)).toBeTrue();
  });

  it('recusa o Chrome no iPhone', () => {
    // Por dentro e o mesmo WebKit, mas o menu de compartilhar do Chrome no iOS
    // NAO tem "Adicionar a Tela de Inicio". Mandar o passo a passo do Safari
    // faz a pessoa procurar um botao que nao existe.
    expect(ehSafariNoIos(UA.iphoneChrome)).toBeFalse();
  });

  it('recusa os outros navegadores do iOS', () => {
    for (const marca of ['FxiOS', 'EdgiOS', 'OPiOS', 'GSA']) {
      expect(ehSafariNoIos(`... ${marca}/1.0 Mobile/15E148`)).toBeFalse();
    }
  });
});
