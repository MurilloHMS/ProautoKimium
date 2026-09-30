import { TestBed } from '@angular/core/testing';

import { NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';
import { CIENTE_POR_DIAS, FraudAlertComponent } from './fraud-alert.component';

const DIA = 86_400_000;
const HOJE = new Date(2026, 8, 30, 10, 0);

/**
 * O alerta de golpe da página pública. No celular, "Estou ciente" vale 90 dias
 * (pedido dele, 2026-09-30); no computador, só a sessão, como antes.
 */
describe('FraudAlertComponent', () => {

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jasmine.clock().install();
    jasmine.clock().mockDate(HOJE);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    restaurarLargura();
    localStorage.clear();
    sessionStorage.clear();
  });

  function abrir(largura: number): FraudAlertComponent {
    larguraDaJanela(largura);
    TestBed.configureTestingModule({ imports: [FraudAlertComponent], providers: providersDeTeste() });
    const fixture = TestBed.createComponent(FraudAlertComponent);
    fixture.detectChanges();
    jasmine.clock().tick(400);
    return fixture.componentInstance;
  }

  /**
   * Simula outra visita: nova sessão, mesmo aparelho, `dias` depois DO CLIQUE
   * em "Estou ciente" — é dele que o prazo conta, e ele acontece 400 ms depois
   * de o aviso abrir. Contar de "hoje" deixaria o teste 400 ms antes do prazo.
   */
  function voltarDepoisDe(dias: number): void {
    const clique = Number(localStorage.getItem('proauto_fraud_alert_ciente_em')) || HOJE.getTime();
    TestBed.resetTestingModule();
    sessionStorage.clear();
    jasmine.clock().mockDate(new Date(clique + dias * DIA));
  }

  it('aparece na primeira visita', () => {
    expect(abrir(NO_CELULAR).visible).toBeTrue();
  });

  it('no celular, "Estou ciente" some por 90 dias, mesmo em outra visita', () => {
    abrir(NO_CELULAR).close();

    voltarDepoisDe(1);
    expect(abrir(NO_CELULAR).visible).withContext('um dia depois').toBeFalse();

    voltarDepoisDe(CIENTE_POR_DIAS - 1);
    expect(abrir(NO_CELULAR).visible).withContext('no dia 89').toBeFalse();
  });

  it('no celular, depois dos 90 dias o aviso volta', () => {
    abrir(NO_CELULAR).close();

    voltarDepoisDe(CIENTE_POR_DIAS);

    expect(abrir(NO_CELULAR).visible).toBeTrue();
  });

  it('no computador continua como antes: some na sessão, volta na próxima visita', () => {
    abrir(NO_COMPUTADOR).close();
    expect(localStorage.getItem('proauto_fraud_alert_ciente_em')).withContext('nada guardado por 90 dias').toBeNull();

    voltarDepoisDe(1);
    expect(abrir(NO_COMPUTADOR).visible).toBeTrue();
  });

  it('armazenamento bloqueado: o aviso aparece (o lado seguro), sem erro', () => {
    spyOn(localStorage, 'getItem').and.throwError('SecurityError');
    spyOn(sessionStorage, 'getItem').and.throwError('SecurityError');

    expect(abrir(NO_CELULAR).visible).toBeTrue();
  });
});
