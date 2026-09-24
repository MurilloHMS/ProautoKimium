import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { FuelSupplyComponent } from './fuel-supply.component';
import { environment } from '../../../../../../environments/environment';
import { providersDeTeste } from '../../../../../../testing/test-setup';
import {
  FuelSupplyImportRow,
  FuelSupplyPreviewRow
} from '../../../../../domain/models/fuel-supply-audit.model';

/**
 * A tela de abastecimento, depois que ela virou três passos.
 *
 * <b>O que estes testes guardam.</b> O envio não grava mais nada — quem grava é
 * o passo 2, com o que está na tela. Duas coisas dessa mudança são fáceis de
 * desfazer sem perceber, e as duas custaram caro em produção:
 *
 * <ul>
 *   <li>a duplicata chegar <i>marcada</i>, que faz o reenvio da planilha do mês
 *       passar batido;</li>
 *   <li>a linha sem departamento ser gravada assim mesmo, que desanda o
 *       relatório — ele agrupa por departamento.</li>
 * </ul>
 */
describe('FuelSupplyComponent', () => {
  let component: FuelSupplyComponent;
  let fixture: ComponentFixture<FuelSupplyComponent>;
  let http: HttpTestingController;

  const DEPARTAMENTOS = [
    { id: 'dep-log', name: 'LOGISTICA' },
    { id: 'dep-adm', name: 'ADMINISTRATIVO' },
  ];

  function linhaLida(over: Partial<FuelSupplyPreviewRow> = {}): FuelSupplyPreviewRow {
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

  /** Faz o caminho do passo 1 até a conferência aberta. */
  function conferirCom(linhas: FuelSupplyPreviewRow[]): void {
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
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Sem planilha lida não há o que conferir. O botão travado é o que impede a
   * pessoa de cair numa tabela vazia e achar que perdeu o arquivo.
   */
  it('o passo 2 fica travado ate existir uma conferencia', () => {
    const passos = fixture.nativeElement.querySelectorAll('.passo');

    expect(passos.length).toBe(3);
    expect((passos[1] as HTMLButtonElement).disabled).toBeTrue();

    conferirCom([linhaLida()]);

    expect((fixture.nativeElement.querySelectorAll('.passo')[1] as HTMLButtonElement).disabled)
      .toBeFalse();
  });

  /**
   * <b>O reenvio da planilha do mês.</b> A duplicata chega desmarcada; tudo o
   * mais, marcado. Marcar de volta é um clique — dois abastecimentos idênticos
   * no mesmo dia existem —, mas o padrão não pode ser gravar de novo.
   */
  it('a duplicata chega desmarcada, e o resto marcado', () => {
    conferirCom([
      linhaLida({ linha: 2 }),
      linhaLida({ linha: 3, jaExiste: true }),
    ]);

    expect(component.totalLidas()).toBe(2);
    expect(component.marcadas().length).toBe(1);
    expect(component.marcadas()[0].linha).toBe(2);
  });

  /** Build verde e tela vazia é o erro clássico: a tabela tem que renderizar. */
  it('a conferencia aparece na tela, com o motorista e a situacao', () => {
    conferirCom([linhaLida({ motoristaEncontrado: false, departmentId: null, departmentName: null })]);

    const texto = fixture.nativeElement.textContent as string;

    expect(texto).toContain('JOAO DA SILVA');
    expect(texto).toContain('sem cadastro');
  });

  /**
   * O departamento sugerido tem que APARECER escolhido no combo. Mostrar
   * "Escolha…" com o valor preenchido por baixo faria a pessoa escolher tudo de
   * novo, uma linha por vez — que é o trabalho que a sugestão existe para
   * poupar.
   *
   * <b>Os dois `whenStable`.</b> São dois `ngModel` empilhados — o do
   * `pk-combobox` e o do `p-select` dentro dele —, e cada um escreve o valor
   * numa microtarefa. Com uma rodada só, o combo ainda mostra o placeholder.
   * No navegador isso é um quadro; no teste é a diferença entre verde e
   * vermelho.
   */
  it('o departamento sugerido ja aparece selecionado no combo', async () => {
    conferirCom([linhaLida()]);

    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('LOGISTICA');
  });

  /**
   * <b>Uma pessoa dirige para um departamento só.</b> A planilha de agosto tem
   * 246 linhas e 34 motoristas: escolher linha a linha seriam 246 cliques para
   * 34 decisões — e bastaria errar uma para a mesma pessoa aparecer em dois
   * departamentos no relatório do mês.
   */
  it('o departamento escolhido vale para TODAS as linhas do motorista', () => {
    conferirCom([
      linhaLida({ linha: 2, driverName: 'Marcio Gabe Silveira', departmentId: null, departmentName: null }),
      linhaLida({ linha: 3, driverName: 'Marcio Gabe Silveira', departmentId: null, departmentName: null }),
      linhaLida({ linha: 4, driverName: 'Outra Pessoa', departmentId: null, departmentName: null }),
    ]);

    component.definirDepartamento(component.linhas()[0], 'dep-log');

    expect(component.linhas()[0].departmentId).toBe('dep-log');
    expect(component.linhas()[1].departmentId)
      .withContext('a segunda linha do mesmo motorista tinha que ir junto')
      .toBe('dep-log');
    expect(component.linhas()[2].departmentId)
      .withContext('e a de outra pessoa nao pode ser tocada')
      .toBeNull();
  });

  /**
   * O cartão escreve o mesmo nome de dois jeitos dentro do mesmo mês — com e
   * sem acento. Continua sendo uma pessoa só, e um departamento só.
   */
  it('acento nao separa o motorista de si mesmo na hora de aplicar', () => {
    conferirCom([
      linhaLida({ linha: 2, driverName: 'Márcio Gabe Silveira', departmentId: null, departmentName: null }),
      linhaLida({ linha: 3, driverName: 'Marcio Gabe Silveira', departmentId: null, departmentName: null }),
    ]);

    component.definirDepartamento(component.linhas()[0], 'dep-adm');

    expect(component.linhas()[1].departmentId).toBe('dep-adm');
  });

  it('a conferencia conta motoristas, e nao so linhas', () => {
    conferirCom([
      linhaLida({ linha: 2, driverName: 'Marcio Gabe Silveira' }),
      linhaLida({ linha: 3, driverName: 'Marcio Gabe Silveira' }),
      linhaLida({ linha: 4, driverName: 'Outra Pessoa' }),
    ]);

    expect(component.totalLidas()).toBe(3);
    expect(component.totalDeMotoristas()).toBe(2);
  });

  /**
   * A busca é o que torna 246 linhas navegáveis: acha o motorista, resolve o
   * departamento dele, passa para o próximo.
   */
  it('a busca filtra por motorista, ignorando acento', () => {
    conferirCom([
      linhaLida({ linha: 2, driverName: 'Márcio Gabe Silveira' }),
      linhaLida({ linha: 3, driverName: 'Outra Pessoa', plate: 'XYZ9A88' }),
    ]);

    component.busca.set('marcio');
    fixture.detectChanges();

    expect(component.linhasVisiveis().length).toBe(1);
    expect(component.linhasVisiveis()[0].driverName).toBe('Márcio Gabe Silveira');
  });

  it('a busca tambem acha pela placa', () => {
    conferirCom([
      linhaLida({ linha: 2, driverName: 'Marcio Gabe Silveira', plate: 'ABC1D23' }),
      linhaLida({ linha: 3, driverName: 'Outra Pessoa', plate: 'XYZ9A88' }),
    ]);

    component.busca.set('xyz9');
    fixture.detectChanges();

    expect(component.linhasVisiveis().length).toBe(1);
    expect(component.linhasVisiveis()[0].plate).toBe('XYZ9A88');
  });

  /** A busca some junto com a conferência: nada de filtro herdado do mês passado. */
  it('descartar a conferencia limpa a busca', () => {
    conferirCom([linhaLida()]);
    component.busca.set('marcio');

    component.descartarConferencia();

    expect(component.busca()).toBe('');
  });

  /**
   * <b>O defeito que a tela existe para corrigir.</b> Antes, a linha sem
   * motorista casado era gravada em SEM_DEPARTAMENTO sem avisar ninguém.
   */
  it('linha marcada sem departamento nao chega a chamar a API', () => {
    conferirCom([linhaLida({ departmentId: null, departmentName: null, motoristaEncontrado: false })]);

    component.gravar();

    http.expectNone(`${environment.apiUrl}/fuelsupply/import`);
    expect(component.semDepartamento().length).toBe(1);
  });

  it('grava so as linhas marcadas, com o departamento que esta na tela', () => {
    conferirCom([
      linhaLida({ linha: 2 }),
      linhaLida({ linha: 3, jaExiste: true }),
    ]);

    component.definirDepartamento(component.linhas()[0], 'dep-adm');
    component.gravar();

    const req = http.expectOne(`${environment.apiUrl}/fuelsupply/import`);
    const corpo = req.request.body as FuelSupplyImportRow[];

    expect(corpo.length).toBe(1);
    expect(corpo[0].linha).toBe(2);
    expect(corpo[0].departmentId).toBe('dep-adm');

    req.flush({ gravadas: 1, recusadas: 0, motivos: [] });
  });

  /**
   * A gravação é tudo ou nada. Quando a API recusa, a tela tem que mostrar
   * QUAIS linhas — "erro ao gravar" não conserta planilha nenhuma.
   */
  it('recusa da API vira a lista de motivos na tela', () => {
    conferirCom([linhaLida()]);

    component.gravar();

    http.expectOne(`${environment.apiUrl}/fuelsupply/import`).flush(
      { gravadas: 0, recusadas: 1, motivos: ['Linha 2: a placa está em branco.'] },
      { status: 422, statusText: 'Unprocessable Entity' });

    fixture.detectChanges();

    expect(component.recusas().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Linha 2: a placa está em branco.');
  });

  /**
   * O download passa pelo HttpClient de propósito: `window.open` na URL da API
   * não leva o JWT e volta 403 — foi assim que o currículo do RH quebrou.
   */
  it('o modelo e baixado pelo HttpClient, que leva o token', () => {
    component.baixarModelo();

    const req = http.expectOne(`${environment.apiUrl}/fuelsupply/model`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  /**
   * O passo 3 abre sempre: emitir o relatório de março não depende de ter
   * acabado de importar agosto.
   */
  it('o passo 3 abre mesmo sem conferencia nenhuma', () => {
    component.irPara(3);
    fixture.detectChanges();

    expect(component.passo()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Gerar relatório');
  });
});
