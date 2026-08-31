import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';

import { ProgramacaoComponent } from './programacao.component';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { MachineRegister, UpdateMachineRegister } from '../../../../domain/models/prostock/register.model';
import { Machine, MachineStatus } from '../../../../domain/models/prostock/machine.model';

/**
 * A programação mexendo no estoque (Parte 4).
 *
 * O que estes testes protegem é **quando a tela não pergunta**. Perguntar
 * demais numa grade que se edita o dia todo é o jeito mais rápido de ensinar
 * alguém a clicar em "Confirmar" sem ler — e aí a confirmação deixa de valer
 * para as vezes em que ela importa.
 */
describe('ProgramacaoComponent · estoque', () => {
  let component: ProgramacaoComponent;
  let fixture: ComponentFixture<ProgramacaoComponent>;

  let registerService: jasmine.SpyObj<RegisterService>;
  let inventoryService: jasmine.SpyObj<InventoryProductService>;
  let registerStore: MachineRegisterStore;
  let machineStore: MachineStore;

  const MACHINE_ID = 'm0000000-0000-0000-0000-000000000001';
  const REGISTER_ID = 'r0000000-0000-0000-0000-000000000001';

  const machine: Machine = {
    id: MACHINE_ID,
    systemCode: 'MAQ-001',
    name: 'Lavadora',
    brand: 'Marca',
    machineType: null,
    machineStatus: null,
    minimum_stock: 1,
    active: true,
  };

  const register = (status: MachineStatus): MachineRegister => ({
    id: REGISTER_ID,
    machineId: MACHINE_ID,
    nomeCliente: 'Cliente',
    tag: 1,
    regiao: 'Sul',
    solicitante: 'Solicitante',
    status,
    Observacao: '',
    previsaoEntrega: null,
    consultor: 'Consultor',
    tecnico: 'Técnico',
  });

  /** A linha da grade é o registro mais a data já convertida. */
  const rowWith = (stored: MachineRegister, status: MachineStatus) =>
    ({ ...stored, status, previsao: null }) as never;

  const stockIs = (quantity: number) => {
    inventoryService.getInventoryMovementsByProduct.and.returnValue(of([
      { systemCode: 'MAQ-001', quantity, movementDate: '2026-08-01T10:00:00' },
    ]));
  };

  /** O `update` que a tela acabou de disparar. */
  const lastPayload = (): UpdateMachineRegister =>
    registerService.update.calls.mostRecent().args[1];

  beforeEach(async () => {
    registerService = jasmine.createSpyObj<RegisterService>('RegisterService', [
      'getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges',
    ]);
    registerService.getAll.and.returnValue(of([]));
    registerService.create.and.returnValue(of('ok'));
    registerService.update.and.returnValue(of('ok'));

    const machineService = jasmine.createSpyObj<MachineService>('MachineService', ['getAll', 'reconcile']);
    machineService.getAll.and.returnValue(of([]));

    inventoryService = jasmine.createSpyObj<InventoryProductService>(
      'InventoryProductService', ['getInventoryProducts', 'getInventoryMovementsByProduct']);
    inventoryService.getInventoryProducts.and.returnValue(of([]));
    stockIs(5);

    await TestBed.configureTestingModule({
      imports: [ProgramacaoComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RegisterService, useValue: registerService },
        { provide: MachineService, useValue: machineService },
        { provide: InventoryProductService, useValue: inventoryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgramacaoComponent);
    component = fixture.componentInstance;

    // Stores reais, populados direto: `upsert` é o mesmo caminho que a tela usa
    // depois de gravar, então o estado fica idêntico ao de uso real sem HTTP.
    registerStore = TestBed.inject(MachineRegisterStore);
    machineStore = TestBed.inject(MachineStore);
    machineStore.upsert(machine);
  });

  /**
   * **O teste que impede o atrito.**
   *
   * Reservar não é entregar: a máquina continua no galpão. Um diálogo aqui
   * apareceria dezenas de vezes por dia sem nada a dizer.
   */
  it('mudar entre status de estoque não pergunta nada e grava direto', () => {
    registerStore.upsert(register(MachineStatus.DISPONIVEL));

    component.onCellEdited(rowWith(register(MachineStatus.DISPONIVEL), MachineStatus.RESERVADA));

    expect(component.stockDialogOpen()).toBeFalse();
    expect(registerService.update).toHaveBeenCalled();
    expect(lastPayload().adjustStock).toBeUndefined();
  });

  it('marcar ENTREGUE pergunta antes e não grava ainda', () => {
    registerStore.upsert(register(MachineStatus.DISPONIVEL));

    component.onCellEdited(rowWith(register(MachineStatus.DISPONIVEL), MachineStatus.ENTREGUE));

    expect(component.stockDialogOpen()).toBeTrue();
    expect(component.stockDelta()).toBe(-1);
    expect(component.currentStock()).toBe(5);
    expect(component.newStock()).toBe(4);
    expect(registerService.update).not.toHaveBeenCalled();
  });

  it('confirmar grava com adjustStock ligado', () => {
    registerStore.upsert(register(MachineStatus.DISPONIVEL));
    component.onCellEdited(rowWith(register(MachineStatus.DISPONIVEL), MachineStatus.ENTREGUE));

    component.confirmStockChange();

    expect(lastPayload().adjustStock).toBeTrue();
    expect(lastPayload().status).toBe(MachineStatus.ENTREGUE);
    expect(component.stockDialogOpen()).toBeFalse();
  });

  /** O caso que ele reportou: voltar de ENTREGUE tem que devolver ao estoque. */
  it('voltar de ENTREGUE soma 1', () => {
    registerStore.upsert(register(MachineStatus.ENTREGUE));

    component.onCellEdited(rowWith(register(MachineStatus.ENTREGUE), MachineStatus.DISPONIVEL));

    expect(component.stockDelta()).toBe(1);
    expect(component.newStock()).toBe(6);
  });

  /**
   * AGUARDANDO_AQUISICAO é máquina que ainda não chegou — nunca entrou no
   * estoque, então entregá-la não pode baixar nada. É a metade da regra que
   * some quando alguém lê só "só ENTREGUE".
   */
  it('entregar o que nunca esteve em estoque não pergunta nada', () => {
    registerStore.upsert(register(MachineStatus.AGUARDANDO_AQUISICAO));

    component.onCellEdited(
      rowWith(register(MachineStatus.AGUARDANDO_AQUISICAO), MachineStatus.ENTREGUE));

    expect(component.stockDialogOpen()).toBeFalse();
    expect(registerService.update).toHaveBeenCalled();
  });

  /**
   * **Divergência que já existia não pode travar o trabalho.**
   *
   * Se o estoque em movimentações está zerado e a programação diz que há
   * máquina, a API recusaria a baixa. Em vez de deixar a pessoa sem saída, o
   * botão troca de função e grava só o status.
   */
  it('estoque insuficiente troca o botão e grava sem mexer no estoque', () => {
    stockIs(0);
    registerStore.upsert(register(MachineStatus.DISPONIVEL));

    component.onCellEdited(rowWith(register(MachineStatus.DISPONIVEL), MachineStatus.ENTREGUE));

    expect(component.stockWouldGoNegative()).toBeTrue();

    component.confirmStockChange();

    expect(lastPayload().adjustStock).toBeFalse();
    expect(lastPayload().status).toBe(MachineStatus.ENTREGUE);
  });

  /**
   * Desistir não pode deixar o status novo na tela: a pessoa sairia achando
   * que salvou. O `refresh` traz de volta o que está no banco.
   */
  it('cancelar não grava nada', () => {
    registerStore.upsert(register(MachineStatus.DISPONIVEL));
    component.onCellEdited(rowWith(register(MachineStatus.DISPONIVEL), MachineStatus.ENTREGUE));

    component.cancelStockChange();

    expect(component.stockDialogOpen()).toBeFalse();
    expect(registerService.update).not.toHaveBeenCalled();
  });

  // ─── Linha nova ───────────────────────────────────────────────────────────

  /**
   * **Linha sem cliente é legítima.**
   *
   * Uma linha É uma máquina física, então máquina no galpão que ninguém
   * prometeu ainda tem linha — ela cai em "Sem previsão" esperando destino. O
   * acerto de divergência já cria linhas assim; exigir cliente aqui deixava o
   * sistema fazer o que a pessoa não podia.
   */
  it('salva a linha só com a máquina', () => {
    const draft = { machineId: 'm1', nomeCliente: '', status: MachineStatus.DISPONIVEL } as never;

    expect(component.canSaveDraft(draft)).toBeTrue();
  });

  /** A máquina continua obrigatória: sem ela a linha não é de nada. */
  it('sem máquina, não salva', () => {
    const draft = { machineId: '', nomeCliente: 'Cliente', status: MachineStatus.DISPONIVEL } as never;

    expect(component.canSaveDraft(draft)).toBeFalse();
  });

  // ─── O status na criação ──────────────────────────────────────────────────

  /**
   * **A linha nova nasce sem status.**
   *
   * Ela nascia em `DISPONIVEL`, e quem não reparasse na célula criava máquina
   * em estoque e confirmava o `+1` sem querer. O caso que o padrão atrapalhava
   * é `AGUARDANDO_AQUISICAO` — máquina que ainda não foi comprada.
   */
  it('a linha nova nasce sem status', () => {
    component.addRow();

    expect(component.drafts()[0].status).toBeNull();
  });

  it('sem status escolhido, não salva', () => {
    const draft = { machineId: 'm1', status: null } as never;

    expect(component.canSaveDraft(draft)).toBeFalse();
  });

  /**
   * **O botão desabilitado não é a trava.**
   *
   * Sem esta guarda, `stockDeltaFor(null, null)` dá 0 — o status nulo não está
   * em `IN_STOCK_STATUSES` — e a linha cairia direto no POST com `status: null`,
   * deixando a API decidir. O botão "impede" até alguém chamar por atalho de
   * teclado.
   */
  it('salvar um rascunho sem status não chama a API nem abre o diálogo', () => {
    component.addRow();

    component.saveDraft(component.drafts()[0]);

    expect(registerService.create).not.toHaveBeenCalled();
    expect(component.stockDialogOpen()).toBeFalse();
  });

  /**
   * O par do de cima, e ele existe por um motivo específico: sozinho, o
   * anterior passaria se alguém "consertasse" o erro de tipo com
   * `row.status ?? DISPONIVEL` — e aí toda linha nova voltaria a somar estoque.
   */
  it('criar em DISPONIVEL continua perguntando pelo estoque', () => {
    component.addRow();
    const draft = component.drafts()[0];
    draft.machineId = MACHINE_ID;
    draft.status = MachineStatus.DISPONIVEL;

    component.saveDraft(draft);

    expect(component.stockDialogOpen()).toBeTrue();
    expect(component.stockDelta()).toBe(1);
  });

  /**
   * **O teste que dá sentido ao pedido dele.**
   *
   * `AGUARDANDO_AQUISICAO` é máquina que ainda não foi comprada: criar a linha
   * não pode lançar entrada. Hoje isso funciona por consequência do
   * `stockDeltaFor`, e nada afirmava. Se alguém "simplificar" a regra, máquina
   * não comprada passa a somar no estoque — e o erro só aparece na
   * conciliação, dias depois.
   */
  it('criar em AGUARDANDO_AQUISICAO grava direto, sem tocar no estoque', () => {
    component.addRow();
    const draft = component.drafts()[0];
    draft.machineId = MACHINE_ID;
    draft.status = MachineStatus.AGUARDANDO_AQUISICAO;

    component.saveDraft(draft);

    expect(component.stockDialogOpen()).toBeFalse();
    expect(registerService.create).toHaveBeenCalled();
  });

  // ─── Ordenação ────────────────────────────────────────────────────────────

  /**
   * **O fixture tem a ordem dos nomes INVERTIDA em relação à dos ids.**
   *
   * Sem isso, este teste passa dos dois jeitos: a ordem por UUID é
   * determinística, e nem quem revisa o PR nem quem usa a tela distingue
   * "ordenado por nome" de "ordenado por uuid" sem saber os nomes de cor.
   */
  const comTresMaquinas = () => {
    machineStore.upsert({ ...machine, id: 'a-1', systemCode: 'A1', name: 'Zebra' });
    machineStore.upsert({ ...machine, id: 'm-2', systemCode: 'M2', name: 'Mesa' });
    machineStore.upsert({ ...machine, id: 'z-3', systemCode: 'Z3', name: 'Alfa' });

    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'r1', machineId: 'a-1' });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'r2', machineId: 'm-2' });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'r3', machineId: 'z-3' });
  };

  it('ordenar por Máquina usa o NOME, não o id', () => {
    comTresMaquinas();

    component.toggleSort('machine');

    expect(component.rows().map(r => component.machineName(r.machineId)))
      .toEqual(['Alfa', 'Mesa', 'Zebra']);
  });

  it('sem ordenação, mantém a ordem que veio do store', () => {
    comTresMaquinas();

    expect(component.rows().map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  /** Crescente → decrescente → a ordem de origem. */
  it('o terceiro clique volta à ordem original', () => {
    comTresMaquinas();

    component.toggleSort('machine');
    component.toggleSort('machine');
    component.toggleSort('machine');

    expect(component.sortBy()).toBeNull();
    expect(component.rows().map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  /**
   * **O rascunho não participa da ordenação.**
   *
   * Era o que a ordenação nativa do PrimeNG quebraria: a linha que a pessoa
   * acabou de criar escorregaria para a posição 140, e ela acharia que sumiu.
   */
  it('o rascunho continua no topo com a lista ordenada', () => {
    comTresMaquinas();
    component.addRow();

    component.toggleSort('machine');

    expect(component.rows()[0].id).toContain('draft-');
  });

  /**
   * **Vazio no fim nas DUAS direções.**
   *
   * Célula "—" é ausência de dado, não valor baixo. Afirmar só o crescente
   * passaria com um comparador ingênuo, que joga o nulo para o topo ao inverter.
   */
  it('linha sem previsão fica no fim, crescente e decrescente', () => {
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'sem',
      previsaoEntrega: null });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'com',
      previsaoEntrega: '2026-09-10T00:00:00' });

    component.toggleSort('previsao');
    expect(component.rows().map(r => r.id)).toEqual(['com', 'sem']);

    component.toggleSort('previsao');
    expect(component.rows().map(r => r.id)).toEqual(['com', 'sem']);
  });

  /** O clássico silencioso: sem comparar como número, 10 vem antes de 9. */
  it('tag ordena como número', () => {
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'a', tag: 10 });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'b', tag: 2 });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'c', tag: 9 });

    component.toggleSort('tag');

    expect(component.rows().map(r => r.id)).toEqual(['b', 'c', 'a']);
  });
});
