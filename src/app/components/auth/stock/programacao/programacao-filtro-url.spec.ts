import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

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
          useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
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
});
