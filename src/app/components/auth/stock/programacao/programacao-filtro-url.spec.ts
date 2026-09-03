import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { ProgramacaoComponent } from './programacao.component';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineStatus } from '../../../../domain/models/prostock/machine.model';

/**
 * A ponte entre o Hub e a Programação.
 *
 * O Hub manda a pessoa para cá com o recorte na URL — "cliquei em Prontas".
 * **É o elo mais frágil do trabalho todo:** se o parâmetro não for entendido, o
 * clique parece funcionar (a tela abre) e entrega a lista errada. Ninguém vê
 * erro; a pessoa só decide em cima do recorte que não pediu.
 *
 * O caso perigoso é o do meio: parâmetro inválido virando lista vazia. Lista de
 * filtros vazia desenha a tela **exatamente igual** a "sem filtro nenhum".
 */
describe('ProgramacaoComponent · filtro vindo da URL', () => {
  let component: ProgramacaoComponent;
  let fixture: ComponentFixture<ProgramacaoComponent>;

  /** A URL viva: empurrar um valor aqui é navegar de novo para a mesma tela. */
  let urlAtual: BehaviorSubject<ParamMap>;

  /** Monta a tela como se ela tivesse sido aberta com estes query params. */
  async function abrirCom(params: Record<string, string>): Promise<void> {
    const registerService = jasmine.createSpyObj<RegisterService>('RegisterService', [
      'getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges',
    ]);
    registerService.getAll.and.returnValue(of([]));

    const machineService = jasmine.createSpyObj<MachineService>('MachineService', ['getAll', 'reconcile']);
    machineService.getAll.and.returnValue(of([]));

    const inventoryService = jasmine.createSpyObj<InventoryProductService>(
      'InventoryProductService', ['getInventoryProducts', 'getInventoryMovementsByProduct']);
    inventoryService.getInventoryProducts.and.returnValue(of([]));
    inventoryService.getInventoryMovementsByProduct.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ProgramacaoComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RegisterService, useValue: registerService },
        { provide: MachineService, useValue: machineService },
        { provide: InventoryProductService, useValue: inventoryService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: (urlAtual = new BehaviorSubject(convertToParamMap(params))),
            snapshot: { queryParamMap: convertToParamMap(params) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgramacaoComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('aplica o status que veio na URL', async () => {
    await abrirCom({ status: 'DISPONIVEL' });

    expect(component.statusFilter()).toEqual([MachineStatus.DISPONIVEL]);
    expect(component.hasFilters())
      .withContext('o filtro precisa aparecer nos controles, não só nos dados')
      .toBeTrue();
  });

  it('aceita mais de um status separado por vírgula', async () => {
    // O filtro é multiselect, então "prontas ou reservadas" é um recorte real.
    await abrirCom({ status: 'DISPONIVEL,RESERVADA' });

    expect(component.statusFilter()).toEqual([
      MachineStatus.DISPONIVEL,
      MachineStatus.RESERVADA,
    ]);
  });

  it('não se importa com espaço nem com caixa', async () => {
    await abrirCom({ status: ' disponivel , RESERVADA ' });

    expect(component.statusFilter()).toEqual([
      MachineStatus.DISPONIVEL,
      MachineStatus.RESERVADA,
    ]);
  });

  /**
   * **O teste que protege contra o erro invisível.**
   *
   * Um status que não existe não pode virar `[]`: lista vazia é o mesmo desenho
   * de "sem filtro", e a pessoa veria a grade inteira achando que estava vendo
   * um recorte.
   */
  it('ignora status inventado, e não vira filtro vazio', async () => {
    await abrirCom({ status: 'PRONTAS' });

    expect(component.statusFilter()).toEqual([]);
    expect(component.hasFilters())
      .withContext('sem filtro válido, a tela tem que se declarar sem filtro')
      .toBeFalse();
  });

  it('aproveita o que vale quando parte do parâmetro é lixo', async () => {
    await abrirCom({ status: 'DISPONIVEL,VOADORA' });

    expect(component.statusFilter()).toEqual([MachineStatus.DISPONIVEL]);
  });

  it('aplica o filtro de máquina', async () => {
    await abrirCom({ maquina: 'm-0001' });

    expect(component.machineFilter()).toBe('m-0001');
    expect(component.hasFilters()).toBeTrue();
  });

  it('aplica máquina e status juntos, que é o clique no chip do Hub', async () => {
    await abrirCom({ maquina: 'm-0001', status: 'REFORMA' });

    expect(component.machineFilter()).toBe('m-0001');
    expect(component.statusFilter()).toEqual([MachineStatus.REFORMA]);
  });

  it('liga "só atrasadas" com atrasadas=1', async () => {
    await abrirCom({ atrasadas: '1' });

    expect(component.onlyLate()).toBeTrue();
  });

  it('não liga "só atrasadas" com qualquer outro valor', async () => {
    // `atrasadas=0` tem que desligar, não ligar — senão o parâmetro presente já
    // valeria por si, e um link mal montado inverteria o sentido.
    await abrirCom({ atrasadas: '0' });

    expect(component.onlyLate()).toBeFalse();
  });

  it('sem parâmetro nenhum, a tela abre sem filtro', async () => {
    await abrirCom({});

    expect(component.statusFilter()).toEqual([]);
    expect(component.machineFilter()).toBeNull();
    expect(component.onlyLate()).toBeFalse();
    expect(component.hasFilters()).toBeFalse();
  });

  // ─── Navegar de novo para a mesma tela ──────────────────────────────────

  describe('segundo clique no Hub, com a tela já aberta', () => {

    /**
     * **O bug que ele encontrou em produção.**
     *
     * O Angular reaproveita o componente quando só os query params mudam, então
     * o `ngOnInit` não roda de novo. Lendo o `snapshot` uma vez, o primeiro link
     * do Hub funcionava e todos os seguintes não faziam nada: a tela ficava com
     * o filtro anterior e o clique parecia quebrado.
     */
    it('troca o filtro quando a URL muda com a tela aberta', async () => {
      await abrirCom({ status: 'DISPONIVEL' });
      expect(component.statusFilter()).toEqual([MachineStatus.DISPONIVEL]);

      urlAtual.next(convertToParamMap({ status: 'REFORMA' }));

      expect(component.statusFilter())
        .withContext('a segunda navegação tem que valer como a primeira')
        .toEqual([MachineStatus.REFORMA]);
    });

    /**
     * A URL é a fonte da verdade a cada navegação: o que não vem nela é limpo.
     * Sem isso, ir de `?status=X` para `?maquina=Y` deixaria o status antigo
     * por cima do recorte novo — e o número na tela não bateria com o do Hub.
     */
    it('limpa o que não veio na URL nova', async () => {
      await abrirCom({ status: 'DISPONIVEL', atrasadas: '1' });

      urlAtual.next(convertToParamMap({ maquina: 'm-0002' }));

      expect(component.statusFilter()).toEqual([]);
      expect(component.onlyLate()).toBeFalse();
      expect(component.machineFilter()).toBe('m-0002');
    });

    it('sair para a tela sem filtro nenhum limpa tudo', async () => {
      await abrirCom({ maquina: 'm-0001', status: 'REFORMA' });

      urlAtual.next(convertToParamMap({}));

      expect(component.hasFilters()).toBeFalse();
    });
  });

  // ─── Sem previsão ───────────────────────────────────────────────────────

  describe('filtro "sem previsão"', () => {

    /**
     * Nasceu do Hub: a faixa "Precisa de você" avisa "N máquinas sem previsão"
     * e o botão dizia "Programar", mas abria a grade inteira — a pessoa via o
     * número e tinha que caçar quais eram. Aviso que não leva ao recorte é meio
     * aviso.
     */
    it('liga com semPrevisao=1', async () => {
      await abrirCom({ semPrevisao: '1' });

      expect(component.semPrevisao()).toBeTrue();
      expect(component.hasFilters())
        .withContext('tem que se declarar filtrada, senão a grade curta não se explica')
        .toBeTrue();
    });

    it('não liga com outro valor', async () => {
      await abrirCom({ semPrevisao: '0' });

      expect(component.semPrevisao()).toBeFalse();
    });

    it('limpar filtros também desliga', async () => {
      await abrirCom({ semPrevisao: '1' });
      component.clearFilters();

      expect(component.semPrevisao()).toBeFalse();
      expect(component.hasFilters()).toBeFalse();
    });

    it('a URL nova sem o parâmetro desliga o filtro', async () => {
      await abrirCom({ semPrevisao: '1' });

      urlAtual.next(convertToParamMap({ atrasadas: '1' }));

      expect(component.semPrevisao()).toBeFalse();
      expect(component.onlyLate()).toBeTrue();
    });
  });

  // ─── Saídas até uma data ────────────────────────────────────────────────

  describe('filtro "saídas até"', () => {

    /** Vem do "Ver todas" de "Próximas saídas", que abria a grade inteira. */
    it('aceita a data em ISO', async () => {
      await abrirCom({ ate: '2026-09-10' });

      const ate = component.saidaAte();
      expect(ate).toBeTruthy();
      expect(ate!.getFullYear()).toBe(2026);
      expect(ate!.getMonth()).withContext('setembro é 8').toBe(8);
      expect(ate!.getDate()).toBe(10);
      expect(component.hasFilters()).toBeTrue();
    });

    /**
     * Data inválida cai em "sem filtro", como o status inventado. Uma
     * `Invalid Date` comparada com qualquer coisa devolve `false`, então a
     * grade viria **vazia** sem nada na tela explicando por quê.
     */
    it('ignora data que não dá para ler', async () => {
      await abrirCom({ ate: 'amanha' });

      expect(component.saidaAte()).toBeNull();
      expect(component.hasFilters()).toBeFalse();
    });

    it('limpar filtros também tira a data', async () => {
      await abrirCom({ ate: '2026-09-10' });
      component.clearFilters();

      expect(component.saidaAte()).toBeNull();
    });

    it('a URL nova sem o parâmetro tira a data', async () => {
      await abrirCom({ ate: '2026-09-10' });

      urlAtual.next(convertToParamMap({ semPrevisao: '1' }));

      expect(component.saidaAte()).toBeNull();
      expect(component.semPrevisao()).toBeTrue();
    });
  });
});
