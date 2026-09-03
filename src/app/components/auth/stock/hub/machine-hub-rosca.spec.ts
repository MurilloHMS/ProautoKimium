import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MachineHubComponent } from './machine-hub.component';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineStatus } from '../../../../domain/models/prostock/machine.model';

/**
 * A rosca por status.
 *
 * **Este arquivo existe por causa de um bug que passou por tudo.** A primeira
 * versão montava a cor por concatenação — `var(--app-${severidade})` — e
 * `--app-neutral` não existe no tema; o nome de lá é `--app-text-muted`.
 *
 * Uma parada de cor inválida invalida o `conic-gradient` **inteiro**. O
 * resultado foi um círculo em branco, sem erro no console, sem falha de build e
 * sem teste vermelho — o `ng build` compila strings, não valida CSS em tempo de
 * execução.
 *
 * Por isso o teste que importa aqui **mede o navegador**, e não a string: ele
 * pergunta ao Chrome se o elemento realmente ficou com um fundo pintado. É a
 * única forma de pegar esta classe de defeito ([[medir-antes-de-teorizar-css]]).
 */
describe('MachineHubComponent · rosca por status', () => {
  let component: MachineHubComponent;
  let fixture: ComponentFixture<MachineHubComponent>;
  let registerStore: MachineRegisterStore;

  const registro = (status: MachineStatus, id: string): MachineRegister => ({
    id,
    machineId: 'm-0001',
    nomeCliente: 'Cliente',
    tag: null,
    regiao: 'Sul',
    solicitante: 'Solicitante',
    status,
    Observacao: '',
    previsaoEntrega: null,
    consultor: 'Consultor',
    tecnico: 'Técnico',
  });

  beforeEach(async () => {
    const registerService = jasmine.createSpyObj<RegisterService>('RegisterService', [
      'getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges', 'slipsSince',
    ]);
    registerService.getAll.and.returnValue(of([]));
    registerService.slipsSince.and.returnValue(of([]));

    const machineService = jasmine.createSpyObj<MachineService>(
      'MachineService', ['getAll', 'divergences', 'align', 'reconcile']);
    machineService.getAll.and.returnValue(of([]));
    machineService.divergences.and.returnValue(of([]));

    const inventoryService = jasmine.createSpyObj<InventoryProductService>(
      'InventoryProductService', ['getInventoryProducts', 'getInventoryMovementsByProduct']);
    inventoryService.getInventoryProducts.and.returnValue(of([]));
    inventoryService.getInventoryMovementsByProduct.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [MachineHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: RegisterService, useValue: registerService },
        { provide: MachineService, useValue: machineService },
        { provide: InventoryProductService, useValue: inventoryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MachineHubComponent);
    component = fixture.componentInstance;
    registerStore = TestBed.inject(MachineRegisterStore);
  });

  /**
   * Popula DEPOIS do primeiro `detectChanges`.
   *
   * O `ngOnInit` chama `store.load()`, e o spy devolve lista vazia — qualquer
   * `upsert` feito antes disso é sobrescrito. Foi assim que a primeira versão
   * deste teste falhou com "a rosca não está no DOM", que parecia bug de
   * template e era ordem de montagem.
   */
  function comRegistros(...registros: MachineRegister[]): void {
    fixture.detectChanges();
    registros.forEach(r => registerStore.upsert(r));
    fixture.detectChanges();
  }

  /**
   * **O teste que teria pego o bug.**
   *
   * ENTREGUE é o status de severidade `neutral`, que é justamente a que apontava
   * para um token inexistente. Com ele na lista, o gradiente inteiro morria.
   */
  it('pinta o círculo de verdade, inclusive com o status neutro na lista', () => {
    comRegistros(
      registro(MachineStatus.DISPONIVEL, 'r1'),
      registro(MachineStatus.ENTREGUE, 'r2'),
      registro(MachineStatus.REFORMA, 'r3'));

    const rosca = fixture.nativeElement.querySelector('.rosca') as HTMLElement;
    expect(rosca).withContext('a rosca precisa estar no DOM').toBeTruthy();

    // A pergunta é feita ao navegador, não à string: se qualquer parada de cor
    // for inválida, o Chrome descarta a declaração toda e isto vira 'none'.
    const pintado = getComputedStyle(rosca).backgroundImage;

    expect(pintado)
      .withContext('gradiente inválido cai para "none" e o círculo fica em branco')
      .not.toBe('none');
    expect(pintado).toContain('conic-gradient');
  });

  it('cobre as seis severidades sem invalidar o gradiente', () => {
    comRegistros(...Object.values(MachineStatus).map((status, i) => registro(status, `r${i}`)));

    const rosca = fixture.nativeElement.querySelector('.rosca') as HTMLElement;
    expect(getComputedStyle(rosca).backgroundImage).not.toBe('none');
  });

  it('fecha o círculo: a última fatia termina em 360 graus', () => {
    // Somar porcentagens arredondadas daria 99 ou 101 e deixaria uma fresta.
    comRegistros(
      registro(MachineStatus.DISPONIVEL, 'r1'),
      registro(MachineStatus.RESERVADA, 'r2'),
      registro(MachineStatus.REFORMA, 'r3'));

    expect(component.roscaGradiente()).toContain('360deg');
  });

  it('sem registro nenhum, não tenta desenhar rosca', () => {
    fixture.detectChanges();
    expect(component.roscaGradiente()).toBe('var(--app-surface-2)');
    expect(component.roscaFatias()).toEqual([]);
  });

  // ─── Programações por máquina ───────────────────────────────────────────

  describe('programações abertas por máquina', () => {

    /**
     * **O erro que ele achou depois do merge.**
     *
     * Máquina entregue saiu do galpão: contá-la inflaria o total com trabalho
     * que já terminou, e o cartão responde "quanto ainda tenho nessa máquina".
     */
    it('não conta entregues no total', () => {
      comRegistros(
        registro(MachineStatus.DISPONIVEL, 'r1'),
        registro(MachineStatus.REFORMA, 'r2'),
        registro(MachineStatus.ENTREGUE, 'r3'),
        registro(MachineStatus.ENTREGUE, 'r4'));

      const maquina = component.porMaquina()[0];

      expect(maquina.total)
        .withContext('duas abertas, e as duas entregues fora')
        .toBe(2);
    });

    /**
     * Entregue sai do total **e** dos chips: chip com número fora da soma faria
     * as partes não fecharem com o total, e ninguém confia num cartão que não
     * bate.
     */
    it('as partes somam exatamente o total', () => {
      comRegistros(
        registro(MachineStatus.DISPONIVEL, 'r1'),
        registro(MachineStatus.DISPONIVEL, 'r2'),
        registro(MachineStatus.RESERVADA, 'r3'),
        registro(MachineStatus.ENTREGUE, 'r4'));

      const maquina = component.porMaquina()[0];
      const soma = maquina.partes.reduce((total, parte) => total + parte.count, 0);

      expect(soma).toBe(maquina.total);
      expect(maquina.partes.map(p => p.status))
        .withContext('nenhum chip de entregue')
        .not.toContain(MachineStatus.ENTREGUE);
    });

    /** Máquina que só tem entrega já não é trabalho: sai da lista. */
    it('máquina só com entregues não aparece', () => {
      comRegistros(
        registro(MachineStatus.ENTREGUE, 'r1'),
        registro(MachineStatus.ENTREGUE, 'r2'));

      expect(component.porMaquina()).toEqual([]);
    });
  });
});
