import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { EmailSignatureService } from './email-signature.service';
import { providersDeTeste } from '../../../../testing/test-setup';
import type { TemplateDeAssinatura } from '../../../domain/models/assinatura-template.model';

describe('EmailSignatureService', () => {
  let service: EmailSignatureService;
  let http: HttpTestingController;

  const URL = '/api/email/signature/template';

  function template(): TemplateDeAssinatura {
    return {
      versao: 1,
      canvas: { largura: 700, altura: 300, corDeFundo: '#ffffff',
                fundo: { caminho: null, ajuste: 'PREENCHER' } },
      campos: [{
        id: 'a', chave: 'nome', rotulo: 'Nome', tipo: 'TEXTO',
        obrigatorio: true, exemplo: 'Maria',
        x: 10, y: 20, largura: 300, altura: 40,
        fonte: 'Montserrat', tamanho: 28, peso: 700, italico: false,
        cor: '#232E61', alinhamento: 'ESQUERDA', alinhamentoVertical: 'TOPO',
        alturaDaLinha: 1.2, estouro: 'ENCOLHER', ordem: 0,
      }],
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: providersDeTeste() });
    service = TestBed.inject(EmailSignatureService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('decodifica o documento, que a API entrega como texto', () => {
    // O ponto do teste: a API guarda o layout como String, e quem transforma
    // em objeto e a volta e este servico. Devolver o texto cru daqui faria a
    // tela receber uma string onde espera campos, e quebrar longe daqui.
    let recebido: TemplateDeAssinatura | undefined;
    service.buscar().subscribe(t => (recebido = t));

    http.expectOne(URL).flush({
      document: JSON.stringify(template()),
      updatedAt: '2026-09-02T16:00:00',
      updatedBy: null,
    });

    expect(recebido?.campos[0].chave).toBe('nome');
    expect(recebido?.canvas.largura).toBe(700);
  });

  it('codifica o documento ao salvar, e nao manda o objeto solto', () => {
    service.salvar(template()).subscribe();

    const req = http.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    // O corpo tem que ser { document: "<json>" }, e nao o template em si.
    expect(typeof req.request.body.document).toBe('string');
    expect(JSON.parse(req.request.body.document).campos.length).toBe(1);

    req.flush({ document: JSON.stringify(template()), updatedAt: '', updatedBy: 'murillo' });
  });

  it('envia a arte de fundo como multipart, no campo file', () => {
    // `@RequestParam("file")` do lado do Java so enxerga esse nome.
    const arquivo = new File(['x'], 'arte.png', { type: 'image/png' });
    service.enviarFundo(arquivo).subscribe();

    const req = http.expectOne(`${URL}/background`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBe(arquivo);

    req.flush({ path: '/upload/signature/arte.png', width: 700, height: 300 });
  });

  it('busca a arte como Blob, e nunca como URL de imagem', () => {
    // E isto que impede o canvas de ser contaminado: em producao a arte vem de
    // outro dominio, e ai o toBlob lanca. O proxy de dev esconde o defeito.
    service.baixarFundo('/upload/signature/arte.png').subscribe();

    const req = http.expectOne(r => r.url.endsWith('/upload/signature/arte.png'));
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('cai na arte do bundle quando o template nao tem fundo proprio', () => {
    // O template semeado nasce com `fundo.caminho` nulo, entao este caminho e
    // o do dia um — e ele nao pode depender de arquivo em volume nenhum.
    service.baixarFundoPadrao().subscribe();

    const req = http.expectOne('assets/assinatura/fundo-padrao.png');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
