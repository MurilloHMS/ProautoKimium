import { urlDeMidia, urlDeMidiaCom } from './media-url';

/**
 * O endereço das imagens servidas pela API.
 *
 * **Este é o teste do bug de produção.** O caminho vinha da API começando com
 * `/`, e o navegador resolve isso contra a origem da PÁGINA. Em
 * desenvolvimento site e API são o mesmo host por causa do proxy, então tudo
 * funcionava; em produção o site é `proautokimium.com.br` e os arquivos estão
 * em `api.proautokimium.com`, e toda foto voltava 404.
 *
 * Um teste de tela não pegaria: o `onerror` do `<img>` troca pelo placeholder,
 * a página renderiza inteira, e só o console reclama. O erro estava na
 * construção da URL, e é lá que ele tem que ser afirmado.
 *
 * A suíte roda com `environment.apiUrl = '/api'` (desenvolvimento), então a
 * base é vazia e o resultado é relativo. É o comportamento que o proxy espera.
 */
describe('urlDeMidia', () => {
  it('devolve o placeholder quando não há imagem', () => {
    expect(urlDeMidia(null)).toBe('images/products/placeholder.png');
    expect(urlDeMidia(undefined)).toBe('images/products/placeholder.png');
    expect(urlDeMidia('')).toBe('images/products/placeholder.png');
  });

  /**
   * String só com espaço é o que um campo de texto limpo produz, e ela passaria
   * pela checagem de vazio ingênua — virando uma URL que termina em `/ `.
   */
  it('trata string em branco como ausência', () => {
    expect(urlDeMidia('   ')).toBe('images/products/placeholder.png');
  });

  it('aceita um placeholder próprio', () => {
    expect(urlDeMidia(null, 'images/avatar.png')).toBe('images/avatar.png');
  });

  /**
   * O caso que veio da API. A barra inicial é o que enganava: parece caminho
   * pronto e é justamente o que manda o navegador procurar no host errado.
   */
  it('prefixa a base no caminho vindo da API', () => {
    expect(urlDeMidia('/upload/images/2822-abc.png')).toBe('/upload/images/2822-abc.png');
  });

  /** Sem a barra inicial o resultado tem que ser o mesmo, e não `basecaminho`. */
  it('normaliza caminho sem barra inicial', () => {
    expect(urlDeMidia('upload/images/2822-abc.png')).toBe('/upload/images/2822-abc.png');
  });

  /**
   * Imagem hospedada fora já vem pronta. Prefixar aqui produziria
   * `https://api...//https://outro-site...`, que não falha em lugar nenhum —
   * só não carrega.
   */
  it('deixa URL absoluta intacta', () => {
    expect(urlDeMidia('https://cdn.exemplo.com/foto.png')).toBe('https://cdn.exemplo.com/foto.png');
    expect(urlDeMidia('http://cdn.exemplo.com/foto.png')).toBe('http://cdn.exemplo.com/foto.png');
  });

  /**
   * **Pré-visualização de upload.**
   *
   * `data:` e `blob:` são a imagem que a pessoa acabou de escolher, ainda na
   * memória do navegador. Prefixar host aqui quebraria exatamente a conferência
   * que existe para ela ver o que vai salvar — e quebraria só ali, num caminho
   * que nenhum teste de listagem percorre.
   */
  it('não mexe em preview de upload', () => {
    expect(urlDeMidia('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(urlDeMidia('blob:http://localhost:4200/abc-123')).toBe('blob:http://localhost:4200/abc-123');
  });

  // ─── Com a base de PRODUÇÃO ────────────────────────────────────────────────
  //
  // Tudo acima roda com a base vazia, porque a suíte usa o ambiente de
  // desenvolvimento. É o cenário em que o bug NÃO acontece — afirmar só ele
  // seria um teste verde sobre o caso errado.

  describe('com a base de produção', () => {
    const PROD = 'https://api.proautokimium.com';

    /** O 404 exato que ele viu: a foto era procurada no domínio do site. */
    it('manda a foto para o host da API, não para o do site', () => {
      expect(urlDeMidiaCom(PROD, '/upload/images/2822-58f317e6.png'))
        .toBe('https://api.proautokimium.com/upload/images/2822-58f317e6.png');
    });

    it('não duplica a barra quando o caminho não tem a inicial', () => {
      expect(urlDeMidiaCom(PROD, 'upload/images/foto.png'))
        .toBe('https://api.proautokimium.com/upload/images/foto.png');
    });

    /**
     * O `/api` sai da base porque os arquivos são servidos na raiz do host.
     * Mantido ali, a URL viraria `.../api/upload/images/...` e o resource
     * handler do Spring — registrado em `/upload/images/**` — não casaria:
     * outro 404, com exatamente a mesma cara do primeiro.
     */
    it('a base não carrega o /api', () => {
      expect(urlDeMidiaCom('https://api.proautokimium.com/api'.replace(/\/api\/?$/, ''), '/upload/x.png'))
        .toBe('https://api.proautokimium.com/upload/x.png');
    });

    it('preview de upload continua intocado mesmo com base', () => {
      expect(urlDeMidiaCom(PROD, 'blob:http://localhost:4200/abc')).toBe('blob:http://localhost:4200/abc');
    });
  });
});
