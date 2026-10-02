import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { ProgramacaoComponent } from './programacao.component';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineStatus } from '../../../../domain/models/prostock/machine.model';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';

/**
 * Entregue sai do foco (pedido dele, 2026-10-02): a lista do dia a dia é o que
 * ainda vai sair, e as entregues têm a aba delas.
 */
describe('ProgramacaoComponent · abas em andamento e entregues', () => {
  let component: ProgramacaoComponent;

  const linha = (id: string, status: MachineStatus, tag: string, previsao: string | null = null): MachineRegister => ({
    id, machineId: 'm1', nomeCliente: `Cliente ${id}`, tag, regiao: 'Sul', solicitante: 'S', status,
    Observacao: '', previsaoEntrega: previsao, consultor: 'C', tecnico: 'T',
  });

  const QUADRO = [
    linha('a', MachineStatus.RESERVADA, '1001', '2020-01-10'),
    linha('b', MachineStatus.DISPONIVEL, '1002'),
    linha('c', MachineStatus.ENTREGUE, '1003', '2020-01-05'),
    linha('d', MachineStatus.ENTREGUE, '1004'),
    linha('e', MachineStatus.REFORMA, '1005'),
  ];

  async function abrir(params: Record<string, string> = {}): Promise<void> {
    const registerService = jasmine.createSpyObj<RegisterService>('RegisterService', [
      'getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges',
    ]);
    registerService.getAll.and.returnValue(of(QUADRO));
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
        { provide: ActivatedRoute, useValue: {
          queryParamMap: new BehaviorSubject(convertToParamMap(params)),
          snapshot: { queryParamMap: convertToParamMap(params) },
        } },
      ],
    }).compileComponents();
    component = TestBed.createComponent(ProgramacaoComponent).componentInstance;
    component.ngOnInit();
  }

  const ids = () => component.rows().map(r => r.id).sort();

  afterEach(() => TestBed.resetTestingModule());

  it('abre em andamento, sem as entregues, e as abas dizem quantas há em cada', async () => {
    await abrir();

    expect(component.aba()).toBe('andamento');
    expect(ids()).toEqual(['a', 'b', 'e']);
    expect(component.abaOptions().map(o => o.label)).toEqual(['Em andamento · 3', 'Entregues · 2']);
  });

  it('a aba Entregues mostra só as entregues', async () => {
    await abrir();
    component.setAba('entregues');

    expect(ids()).toEqual(['c', 'd']);
  });

  /**
   * "Atrasadas" ligado e troca para Entregues: a entregue nunca é atrasada,
   * e a aba abriria vazia sem dizer por quê.
   */
  it('trocar de aba desliga os recortes que só valem em andamento', async () => {
    await abrir();
    component.toggleLate();
    component.toggleStatus(MachineStatus.RESERVADA);

    component.setAba('entregues');

    expect(component.onlyLate()).toBeFalse();
    expect(component.statusFilter()).toEqual([]);
    expect(ids()).toEqual(['c', 'd']);
  });

  it('a busca acha a tag de uma máquina entregue, na aba dela', async () => {
    await abrir();
    component.setAba('entregues');
    component.search = '1004';
    component.onSearch();

    expect(ids()).toEqual(['d']);
  });

  it('o Hub manda ?status=ENTREGUE: abre a aba Entregues', async () => {
    await abrir({ status: 'ENTREGUE' });

    expect(component.aba()).toBe('entregues');
    expect(component.statusFilter()).toEqual([]);
    expect(ids()).toEqual(['c', 'd']);
  });

  it('qualquer outro status da URL fica em andamento', async () => {
    await abrir({ status: 'RESERVADA' });

    expect(component.aba()).toBe('andamento');
    expect(ids()).toEqual(['a']);
  });

  it('o chip Entregue não existe mais na fileira; o formulário continua oferecendo o status', async () => {
    await abrir();

    expect(component.chipStatusOptions.map(o => o.value)).not.toContain(MachineStatus.ENTREGUE);
    expect(component.statusOptions.map(o => o.value)).toContain(MachineStatus.ENTREGUE);
  });
});
