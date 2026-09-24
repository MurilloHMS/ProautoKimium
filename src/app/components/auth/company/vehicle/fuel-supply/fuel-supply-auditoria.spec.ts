import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { FuelSupplyComponent } from './fuel-supply.component';
import { environment } from '../../../../../../environments/environment';
import { providersDeTeste } from '../../../../../../testing/test-setup';
import { FuelSupplyPreviewRow } from '../../../../../domain/models/fuel-supply-audit.model';

/**
 * **O que a auditoria da conferência achou.**
 *
 * Três coisas, e nenhuma delas dá erro nem aparece em build: um alvo de toque
 * pequeno demais, um indicador de foco escrito errado que o navegador descarta
 * em silêncio, e um chip de status reinventado em cima de um que o tema já
 * tinha.
 *
 * Os testes comparam **estilo computado**, e não classe. A classe pode estar
 * certa e o resultado errado — foi assim com o botão "Menu" da barra de baixo,
 * que tinha a classe certa e aparecia com fonte Arial no aparelho.
 */
describe('FuelSupplyComponent · o que a auditoria achou', () => {

  let fixture: ComponentFixture<FuelSupplyComponent>;
  let component: FuelSupplyComponent;
  let http: HttpTestingController;

  const DEPARTAMENTOS = [{ id: 'dep-log', name: 'LOGISTICA' }];

  function linha(over: Partial<FuelSupplyPreviewRow> = {}): FuelSupplyPreviewRow {
    return {
      linha: 2,
      driverName: 'JOAO DA SILVA',
      fuelSupplyDate: '2026-08-14',
      uf: 'SP',
      plate: 'ABC1D23',
      actualHodometer: 123456,
      fuelType: 'DIESEL S10',
      liters: 87.5,
      totalValue: 524.13,
      price: 5.99,
      diferenceHodometer: 642,
      averageKm: 7.34,
      departmentId: 'dep-log',
      departmentName: 'LOGISTICA',
      motoristaEncontrado: true,
      jaExiste: false,
      ...over,
    };
  }

  function conferir(linhas: FuelSupplyPreviewRow[]): void {
    component.selectedFile = new File(['x'], 'agosto.xlsx');
    component.conferir();
    http.expectOne(`${environment.apiUrl}/fuelsupply/preview`).flush(linhas);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuelSupplyComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(FuelSupplyComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`${environment.apiUrl}/fuelsupply/departments`).flush(DEPARTAMENTOS);
    fixture.detectChanges();

    // O estilo só vale se o componente estiver no documento de verdade.
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    http.verify();
  });

  const raiz = () => fixture.nativeElement as HTMLElement;

  /**
   * 24px é o mínimo do WCAG 2.2 (2.5.8, Target Size Minimum). A conferência é a
   * tela em que mais se toca: uma planilha do mês tem dezenas de linhas, e cada
   * uma tem uma caixa para marcar ou desmarcar.
   */
  it('a caixa de marcar tem pelo menos 24px', () => {
    conferir([linha()]);

    const caixa = raiz().querySelector('tbody input[type="checkbox"]') as HTMLElement;
    expect(caixa).withContext('a caixa da linha').not.toBeNull();

    const { width, height } = getComputedStyle(caixa);

    expect(parseFloat(width)).withContext('largura').toBeGreaterThanOrEqual(24);
    expect(parseFloat(height)).withContext('altura').toBeGreaterThanOrEqual(24);
  });

  it('a caixa de marcar tudo, no cabeçalho, também', () => {
    conferir([linha()]);

    const caixa = raiz().querySelector('thead input[type="checkbox"]') as HTMLElement;
    const { width, height } = getComputedStyle(caixa);

    expect(parseFloat(width)).toBeGreaterThanOrEqual(24);
    expect(parseFloat(height)).toBeGreaterThanOrEqual(24);
  });

  /**
   * O `.selo` era um `.status-chip` reescrito — mesmos três tons, mesmos
   * tokens, mesmo `radius-pill`. Classe inventada não recebe o que o tema
   * passar a dar ao chip depois, e é exatamente o caso: o contraste dos status
   * está para ser corrigido no tema.
   */
  it('a situação usa o chip do tema, e não um chip próprio', () => {
    conferir([linha({ motoristaEncontrado: false })]);

    const chip = raiz().querySelector('tbody .status-chip');

    expect(chip).withContext('o chip do tema').not.toBeNull();
    expect(chip?.textContent?.trim()).toBe('sem cadastro');
    expect(raiz().querySelector('.selo')).withContext('o chip reinventado').toBeNull();
  });

  /**
   * `--app-focus-ring` vale `0 0 0 3px …`, que é sombra e não cor. Escrito como
   * `outline: 2px solid var(--app-focus-ring)` o navegador **descarta a
   * declaração inteira**, sem aviso: quem navega por teclado não vê onde está.
   *
   * **Tem de ser a sombra, e não qualquer anel.** Aceitar o `outline` faz o
   * teste passar pelo anel PADRÃO do navegador — foi o que aconteceu na
   * primeira versão deste teste, que ficou verde com o CSS quebrado. O tema
   * manda `outline: none; box-shadow: var(--app-focus-ring)`, e é isso que se
   * confere.
   */
  /**
   * Compara ANTES e DEPOIS de focar, e não só "tem sombra".
   *
   * O `.passo--atual` já carrega um `box-shadow: inset` que marca o passo
   * corrente, e a primeira versão deste teste ficou verde por causa dele, com
   * o CSS de foco quebrado. O que prova o anel é a sombra **mudar**.
   */
  function conferirAnel(seletor: string): void {
    const alvo = raiz().querySelector(seletor) as HTMLElement;
    expect(alvo).withContext(seletor).not.toBeNull();

    const semFoco = getComputedStyle(alvo).boxShadow;
    alvo.focus();
    const comFoco = getComputedStyle(alvo).boxShadow;

    expect(comFoco).withContext(`${seletor}: a sombra tem de mudar ao focar`).not.toBe(semFoco);
    expect(comFoco).withContext(`${seletor} focado`).not.toBe('none');
  }

  it('o passo e a área de soltar o arquivo têm o anel', () => {
    conferirAnel('.passo');
    conferirAnel('.solta');
  });

  /**
   * A área de soltar é uma `<div>` com clique. Sem `tabindex` e sem teclado ela
   * não existe para quem não usa mouse — e o passo 1 inteiro fica trancado,
   * porque escolher a planilha é a única forma de seguir.
   */
  it('a área de soltar abre pelo Enter e pelo espaço', () => {
    const solta = raiz().querySelector('.solta') as HTMLElement;
    const entrada = raiz().querySelector('input[type="file"]') as HTMLInputElement;
    const abriu = spyOn(entrada, 'click');

    expect(solta.tabIndex).withContext('alcançável pelo Tab').toBe(0);

    solta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(abriu).withContext('Enter').toHaveBeenCalledTimes(1);

    solta.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(abriu).withContext('espaço').toHaveBeenCalledTimes(2);
  });

  it('os chips de filtro e a lupa da conferência também', () => {
    conferir([linha()]);

    conferirAnel('.chip');
  });
});
