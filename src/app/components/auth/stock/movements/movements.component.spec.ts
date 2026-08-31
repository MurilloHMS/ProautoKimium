import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { MovementsComponent } from './movements.component';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { InventoryProductResponse } from '../../../../domain/models/products.model';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineStatus, ReconcileRequest } from '../../../../domain/models/prostock/machine.model';

/**
 * A conciliação vista da tela.
 *
 * O serviço da API já tem os próprios testes, e eles cobrem a regra. O que se
 * protege aqui é outra coisa: que **produto comum não mudou**, e que a tela não
 * grava nada de máquina sem passar pela conciliação. Um desvio errado no
 * `submit` não quebraria nenhum teste da API — e quebraria o lançamento de
 * estoque, que é operação diária.
 */
describe('MovementsComponent · conciliação', () => {
  let component: MovementsComponent;
  let fixture: ComponentFixture<MovementsComponent>;

  let inventoryService: jasmine.SpyObj<InventoryProductService>;
  let machineService: jasmine.SpyObj<MachineService>;
  let registerService: jasmine.SpyObj<RegisterService>;

  const machineId = 'a0000000-0000-0000-0000-000000000001';

  const product = (isMachine: boolean): InventoryProductResponse => ({
    id: machineId,
    systemCode: 'MAQ-001',
    name: 'Lavadora',
    active: true,
    minimumStock: 1,
    isMachine,
  });

  const schedule = (id: string, status: MachineStatus): MachineRegister => ({
    id,
    machineId,
    nomeCliente: 'Cliente',
    tag: '1',
    regiao: '',
    solicitante: '',
    status,
    Observacao: '',
    previsaoEntrega: null,
    consultor: '',
    tecnico: '',
  });

  beforeEach(async () => {
    inventoryService = jasmine.createSpyObj<InventoryProductService>('InventoryProductService', [
      'getInventoryProducts', 'getInventoryMovementsByProduct', 'addInventoryMovement',
    ]);
    inventoryService.getInventoryProducts.and.returnValue(of([]));
    inventoryService.getInventoryMovementsByProduct.and.returnValue(of([]));
    inventoryService.addInventoryMovement.and.returnValue(of('ok'));

    machineService = jasmine.createSpyObj<MachineService>('MachineService', ['reconcile']);
    machineService.reconcile.and.returnValue(of('ok'));

    registerService = jasmine.createSpyObj<RegisterService>('RegisterService', ['getByMachine']);
    registerService.getByMachine.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [MovementsComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: InventoryProductService, useValue: inventoryService },
        { provide: MachineService, useValue: machineService },
        { provide: RegisterService, useValue: registerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementsComponent);
    component = fixture.componentInstance;
    // Sem `detectChanges` de propósito: o `ngOnInit` carregaria a lista de
    // produtos, que não interessa aqui e traria HTTP junto.
  });

  /**
   * Estoque atual é a quantidade do último movimento.
   *
   * Sem isto toda saída para no `canSubmit`, que recusa deixar o estoque
   * negativo — e o teste passaria sem nunca chegar na conciliação, verde pelo
   * motivo errado.
   */
  const stockIs = (quantity: number) => {
    component.movements.set([
      { systemCode: 'MAQ-001', quantity, movementDate: '2026-08-01T10:00:00' },
    ]);
  };

  /**
   * **O teste do bug de 2026-08-26.**
   *
   * Ele tinha 2 máquinas em estoque, marcou uma como entregue e o estoque foi
   * para 0. `movementDate` é `date` no banco, sem hora: dois lançamentos do
   * mesmo dia empatam, e o "último" da lista saía por acaso.
   *
   * Os itens chegam fora de ordem de propósito. Ordenando por `movementDate`,
   * este teste devolveria 9 — o último da lista como ela chegou.
   */
  it('estoque atual é o último REGISTRADO, não o último datado', () => {
    const mesmoDia = '2026-09-10T00:00:00';
    component.movements.set([
      { systemCode: 'MAQ-001', quantity: 7, movementDate: mesmoDia, createdAt: '2026-09-10T08:00:02Z' },
      { systemCode: 'MAQ-001', quantity: 5, movementDate: mesmoDia, createdAt: '2026-09-10T08:00:03Z' },
      { systemCode: 'MAQ-001', quantity: 9, movementDate: mesmoDia, createdAt: '2026-09-10T08:00:01Z' },
    ]);

    expect(component.currentStock()).toBe(5);
  });

  /** Movimentação antiga, de cliente que não manda o campo, não pode quebrar. */
  it('sem createdAt, cai na data e não estoura', () => {
    component.movements.set([
      { systemCode: 'MAQ-001', quantity: 3, movementDate: '2026-09-09T00:00:00' },
      { systemCode: 'MAQ-001', quantity: 4, movementDate: '2026-09-10T00:00:00' },
    ]);

    expect(component.currentStock()).toBe(4);
  });

  /**
   * **A garantia de que nada mudou para quem não é máquina.**
   *
   * O lançamento de estoque comum é operação diária, e a conciliação não pode
   * aparecer nele nem como diálogo nem como chamada extra.
   */
  it('produto comum grava direto, sem abrir a conciliação', () => {
    component.selected.set(product(false));
    component.quantity.set(2);

    component.submit();

    expect(inventoryService.addInventoryMovement).toHaveBeenCalled();
    expect(component.reconciliationOpen()).toBeFalse();
    expect(machineService.reconcile).not.toHaveBeenCalled();
  });

  it('máquina abre a conciliação e não grava nada ainda', () => {
    component.selected.set(product(true));
    component.quantity.set(2);

    component.submit();

    expect(component.reconciliationOpen()).toBeTrue();
    expect(inventoryService.addInventoryMovement).not.toHaveBeenCalled();
    expect(machineService.reconcile).not.toHaveBeenCalled();
  });

  /**
   * ENTREGUE já saiu do galpão. Oferecer para entregar de novo faria o
   * movimento baixar estoque sem nada ter saído.
   */
  it('a saída lista só as programações em estoque', () => {
    registerService.getByMachine.and.returnValue(of([
      schedule('1', MachineStatus.DISPONIVEL),
      schedule('2', MachineStatus.ENTREGUE),
      schedule('3', MachineStatus.REFORMA),
      schedule('4', MachineStatus.AGUARDANDO_AQUISICAO),
    ]));

    stockIs(5);
    component.selected.set(product(true));
    component.setKind('out');
    component.quantity.set(1);
    component.submit();

    // REFORMA entra (está no galpão); AGUARDANDO_AQUISICAO não (ainda não chegou).
    expect(component.candidates().map(r => r.id)).toEqual(['1', '3']);
  });

  /**
   * **O teste central da tela.**
   *
   * Escolher menos e confirmar é o erro que a conciliação existe para impedir:
   * o estoque cairia 2 e a programação perderia 1. A API recusa de novo — aqui
   * o que se garante é que o botão não mente que dá.
   */
  it('não deixa confirmar com menos programações que a quantidade', () => {
    registerService.getByMachine.and.returnValue(of([
      schedule('1', MachineStatus.DISPONIVEL),
      schedule('2', MachineStatus.DISPONIVEL),
    ]));

    stockIs(5);
    component.selected.set(product(true));
    component.setKind('out');
    component.quantity.set(2);
    component.submit();

    // Chegou mesmo na conciliação: sem isso o resto passaria vazio.
    expect(component.candidates().length).toBe(2);
    expect(component.canConfirmReconciliation()).toBeFalse();

    component.toggleCandidate('1');
    expect(component.canConfirmReconciliation()).toBeFalse();

    component.toggleCandidate('2');
    expect(component.canConfirmReconciliation()).toBeTrue();

    // Desmarcar volta a travar — o clique é alternância, não acúmulo.
    component.toggleCandidate('2');
    expect(component.canConfirmReconciliation()).toBeFalse();
  });

  /**
   * O sinal do delta é o contrato inteiro: negativo é saída.
   *
   * Trocado, uma saída viraria entrada — e o servidor não teria como saber,
   * porque a conta fecharia igual dos dois lados.
   */
  it('a saída manda delta negativo e as programações escolhidas', () => {
    registerService.getByMachine.and.returnValue(of([schedule('1', MachineStatus.DISPONIVEL)]));

    stockIs(5);
    component.selected.set(product(true));
    component.setKind('out');
    component.quantity.set(1);
    component.submit();
    component.toggleCandidate('1');
    component.confirmReconciliation();

    const request = machineService.reconcile.calls.mostRecent().args[0] as ReconcileRequest;
    expect(request.delta).toBe(-1);
    expect(request.registersToDeliver).toEqual(['1']);
    expect(request.registersToCreate).toBe(0);
  });

  it('a entrada manda delta positivo e nenhuma programação para entregar', () => {
    component.selected.set(product(true));
    component.setKind('in');
    component.quantity.set(3);
    component.submit();
    component.confirmReconciliation();

    const request = machineService.reconcile.calls.mostRecent().args[0] as ReconcileRequest;
    expect(request.delta).toBe(3);
    expect(request.registersToCreate).toBe(3);
    expect(request.registersToDeliver).toEqual([]);
    // Entrada não pergunta nada: não faz sentido listar candidatas.
    expect(registerService.getByMachine).not.toHaveBeenCalled();
  });

  /**
   * 400 aqui é a conta não fechando. Fechar o diálogo faria a pessoa refazer a
   * escolha inteira só para ler o motivo.
   */
  it('erro do servidor mantém o diálogo aberto com a escolha intacta', () => {
    registerService.getByMachine.and.returnValue(of([schedule('1', MachineStatus.DISPONIVEL)]));
    machineService.reconcile.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: 'A conta não fecha.' })));

    stockIs(5);
    component.selected.set(product(true));
    component.setKind('out');
    component.quantity.set(1);
    component.submit();
    component.toggleCandidate('1');
    component.confirmReconciliation();

    expect(component.reconciliationOpen()).toBeTrue();
    expect(component.chosenIds().has('1')).toBeTrue();
  });
});
