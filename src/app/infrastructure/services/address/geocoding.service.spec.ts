import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { GeocodingService } from './geocoding.service';
import { providersDeTeste } from '../../../../testing/test-setup';

describe('GeocodingService', () => {
  let service: GeocodingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: providersDeTeste() });
    service = TestBed.inject(GeocodingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function responder(corpo: { lat: string; lon: string }[]): void {
    http.expectOne(r => r.url.startsWith('https://nominatim.openstreetmap.org/search')).flush(corpo);
  }

  it('devolve o ponto, arredondado nas seis casas do banco', done => {
    service.lookup('R. Néo Alves Martins, 2100, Maringá - PR').subscribe(p => {
      // NUMERIC(9,6) na V107: mandar mais casas seria arredondado lá de qualquer jeito.
      expect(p).toEqual({ latitude: -23.422847, longitude: -51.93205 });
      done();
    });

    responder([{ lat: '-23.4228469', lon: '-51.9320501' }]);
  });

  it('pede só no Brasil, para não cair numa homônima de fora', done => {
    service.lookup('Maringá - PR').subscribe(() => done());

    const req = http.expectOne(r => r.url.startsWith('https://nominatim.openstreetmap.org/search'));
    expect(req.request.url).toContain('countrycodes=br');
    req.flush([]);
  });

  /**
   * O token da pessoa não pode ir para um serviço de fora — é o mesmo motivo do
   * `ZipCodeService` usar `HttpBackend`. Aqui a prova é que o interceptor não
   * encostou na requisição.
   */
  it('não manda o JWT para o Nominatim', done => {
    service.lookup('Av. Colombo, 5790, Maringá').subscribe(() => done());

    const req = http.expectOne(r => r.url.startsWith('https://nominatim.openstreetmap.org/search'));
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });

  it('endereço que o Nominatim não acha vira nulo, e não erro', done => {
    service.lookup('Rua Que Não Existe, Cidade Nenhuma').subscribe(p => {
      expect(p).toBeNull();
      done();
    });

    responder([]);
  });

  it('serviço fora do ar vira nulo: o cadastro segue sem o ponto', done => {
    service.lookup('Av. Colombo, 5790, Maringá').subscribe(p => {
      expect(p).toBeNull();
      done();
    });

    http.expectOne(r => r.url.startsWith('https://nominatim.openstreetmap.org/search'))
      .flush('', { status: 503, statusText: 'Service Unavailable' });
  });

  it('texto curto demais nem consulta', done => {
    service.lookup('Maringá').subscribe(p => {
      expect(p).toBeNull();
      done();
    });

    http.expectNone(r => r.url.startsWith('https://nominatim.openstreetmap.org/search'));
  });

  /** `Number('')` é 0, e 0,0 fica no Golfo da Guiné — longe de qualquer evento. */
  it('resposta sem número não vira o ponto zero', done => {
    service.lookup('Av. Colombo, 5790, Maringá').subscribe(p => {
      expect(p).toBeNull();
      done();
    });

    responder([{ lat: '', lon: '' }]);
  });
});
