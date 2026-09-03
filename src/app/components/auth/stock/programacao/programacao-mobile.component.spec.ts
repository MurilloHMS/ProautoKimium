import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ProgramacaoComponent } from './programacao.component';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStore } from '../../../../infrastructure/state/machine.store';
import { MachineRegister, UpdateMachineRegister } from '../../../../domain/models/prostock/register.model';
import { Machine, MachineStatus } from '../../../../domain/models/prostock/machine.model';

/**
 * A edição pelo celular.
 *
 * **O que estes testes protegem não é o layout — é o caminho de gravação.**
 *
 * O cartão e o formulário são portas novas para a mesma linha, e a tentação é
 * cada um chamar o service direto. Quem faz isso pula quatro portões de uma
 * vez: o `hasChanges` que evita o PUT à toa, o `pedeMotivo` que alimenta o
 * histórico, a conciliação de estoque, e a fila entre os dois diálogos.
 *
 * E o pior: **nada quebra na hora.** A tela salva, mostra o check verde, e a
 * perda só aparece semanas depois no Hub, como máquina que adiou sem
 * justificativa. Por isso o caminho é testado, e não só olhado.
 */
describe('ProgramacaoComponent · celular', () => {
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

  const register = (extra: Partial<MachineRegister> = {}): MachineRegister => ({
    id: REGISTER_ID,
    machineId: MACHINE_ID,
    nomeCliente: 'Cliente',
    tag: '1',
    regiao: 'Sul',
    solicitante: 'Solicitante',
    status: MachineStatus.RESERVADA,
    Observacao: '',
    previsaoEntrega: '2026-09-10T00:00:00',
    consultor: 'Consultor',
    tecnico: 'Técnico',
    ...extra,
  });

  /** A linha da grade é o registro mais a data já convertida em Date. */
  const rowOf = (stored: MachineRegister) =>
    ({ ...stored, previsao: stored.previsaoEntrega ? new Date(2026, 8, 10) : null }) as never;

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
    inventoryService.getInventoryMovementsByProduct.and.returnValue(of([
      { systemCode: 'MAQ-001', quantity: 5, movementDate: '2026-08-01T10:00:00' },
    ]));

    await TestBed.configureTestingModule({
      imports: [ProgramacaoComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RegisterService, useValue: registerService },
        { provide: MachineService, useValue: machineService },
        { provide: InventoryProductService, useValue: inventoryService },
        // A tela lê filtros da URL desde que o Hub passou a mandar recorte por
        // link. Sem rota nenhuma, o componente nem constrói.
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgramacaoComponent);
    component = fixture.componentInstance;

    registerStore = TestBed.inject(MachineRegisterStore);
    machineStore = TestBed.inject(MachineStore);
    machineStore.upsert(machine);
  });

  // ─── O atalho da previsão ───────────────────────────────────────────────

  describe('atalho da previsão', () => {

    /**
     * **O teste mais importante do arquivo.**
     *
     * Adiar é a edição que o histórico existe para registrar. Se o cartão
     * gravar sem passar pelo `pedeMotivo`, a pergunta some — e some justamente
     * na tela onde ele mais adia, que é o celular no meio da rua.
     */
    it('trocar a data pelo cartão abre a pergunta do motivo, e ainda não grava', () => {
      const guardado = register();
      registerStore.upsert(guardado);

      const row = rowOf(guardado);
      component.abrirPrevisao(row);
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.confirmarPrevisao();

      expect(component.motivoAberto())
        .withContext('adiar pelo cartão tem que perguntar o motivo')
        .toBeTrue();
      expect(registerService.update)
        .withContext('nada vai para a API antes da resposta')
        .not.toHaveBeenCalled();
    });

    it('confirmando o motivo, a data nova chega à API com a justificativa', () => {
      registerStore.upsert(register());

      component.abrirPrevisao(rowOf(register()));
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.confirmarPrevisao();

      component.motivoTexto.set('peça atrasada no fornecedor');
      component.confirmarMotivo();

      expect(registerService.update).toHaveBeenCalled();
      expect(lastPayload().motivoAlteracaoPrevisao).toBe('peça atrasada no fornecedor');
      expect(lastPayload().previsaoEntrega).toContain('2026-10-15');
    });

    /**
     * Preencher a primeira data é completar cadastro, não adiar. Cobrar
     * justificativa aqui ensina a digitar "ok" para passar da tela — e aí o
     * campo deixa de valer para quem adia de verdade.
     */
    it('preencher a primeira previsão não pede motivo', () => {
      const semData = register({ previsaoEntrega: null });
      registerStore.upsert(semData);

      component.abrirPrevisao(rowOf(semData));
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.confirmarPrevisao();

      expect(component.motivoAberto()).toBeFalse();
      expect(registerService.update).toHaveBeenCalled();
    });

    /** Desistir tem que deixar a tela como estava, não com a data nova. */
    it('cancelar não mexe na linha nem chama a API', () => {
      const guardado = register();
      registerStore.upsert(guardado);

      const row = rowOf(guardado);
      component.abrirPrevisao(row);
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.cancelarPrevisao();

      expect((row as { previsao: Date }).previsao.getMonth())
        .withContext('a linha continua com a data antiga')
        .toBe(8);
      expect(registerService.update).not.toHaveBeenCalled();
    });

    it('escolher a mesma data não gera PUT', () => {
      const guardado = register();
      registerStore.upsert(guardado);

      component.abrirPrevisao(rowOf(guardado));
      component.confirmarPrevisao();

      expect(registerService.update)
        .withContext('o hasChanges tem que barrar')
        .not.toHaveBeenCalled();
    });
  });

  // ─── O formulário completo ──────────────────────────────────────────────

  describe('formulário completo', () => {

    it('abrir e fechar sem mexer não gera PUT', () => {
      const guardado = register();
      registerStore.upsert(guardado);

      component.abrirForm(rowOf(guardado));
      component.fecharForm();

      expect(registerService.update).not.toHaveBeenCalled();
    });

    /**
     * O rascunho é cópia: enquanto não salva, a linha da lista não pode mudar.
     * Sem isso, fechar o formulário deixaria o valor novo na tela sem ter
     * gravado, e a pessoa sairia achando que salvou.
     */
    it('editar e cancelar não altera a linha', () => {
      const guardado = register();
      registerStore.upsert(guardado);

      const row = rowOf(guardado);
      component.abrirForm(row);
      component.editarCampo('tecnico', 'Outro técnico');
      component.fecharForm();

      expect((row as { tecnico: string }).tecnico).toBe('Técnico');
      expect(registerService.update).not.toHaveBeenCalled();
    });

    /**
     * Trocar o técnico também passa pelo motivo — ele é um dos oito campos do
     * histórico, e alterar valor já preenchido conta como decisão a
     * justificar. Foi este teste que provou o caminho: escrito esperando um
     * PUT direto, ele falhou, e o certo era ele.
     */
    it('salvar aplica na linha e manda os nove campos', () => {
      registerStore.upsert(register());

      component.abrirForm(rowOf(register()));
      component.editarCampo('tecnico', 'Outro técnico');
      component.salvarForm();

      expect(component.motivoAberto())
        .withContext('trocar o técnico é alteração registrada')
        .toBeTrue();
      component.confirmarMotivo();

      expect(registerService.update).toHaveBeenCalled();
      expect(lastPayload().tecnico).toBe('Outro técnico');
      // Os outros oito continuam indo: a API não tem PATCH.
      expect(lastPayload().nomeCliente).toBe('Cliente');
      expect(lastPayload().regiao).toBe('Sul');
      expect(lastPayload().status).toBe(MachineStatus.RESERVADA);
    });

    /**
     * O formulário não é atalho para furar a conciliação: mudar o status para
     * ENTREGUE tira a máquina do estoque, e a pergunta é a mesma da planilha.
     */
    it('mudar o status para ENTREGUE ainda abre o diálogo de estoque', () => {
      registerStore.upsert(register({ status: MachineStatus.DISPONIVEL }));

      component.abrirForm(rowOf(register({ status: MachineStatus.DISPONIVEL })));
      component.editarCampo('status', MachineStatus.ENTREGUE);
      component.salvarForm();

      expect(component.stockDialogOpen()).toBeTrue();
      expect(registerService.update).not.toHaveBeenCalled();
    });

    /**
     * Os dois diálogos podem cair na mesma edição. **Em fila, nunca
     * sobrepostos** — um por cima do outro esconderia metade da pergunta.
     */
    it('mudar data e status juntos pergunta o motivo primeiro, o estoque depois', () => {
      registerStore.upsert(register({ status: MachineStatus.DISPONIVEL }));

      component.abrirForm(rowOf(register({ status: MachineStatus.DISPONIVEL })));
      component.editarCampo('status', MachineStatus.ENTREGUE);
      component.editarCampo('previsao', new Date(2026, 9, 20) as never);
      component.salvarForm();

      expect(component.motivoAberto())
        .withContext('o motivo vem primeiro')
        .toBeTrue();
      expect(component.stockDialogOpen())
        .withContext('e o de estoque ainda não abriu')
        .toBeFalse();

      component.confirmarMotivo();

      expect(component.stockDialogOpen())
        .withContext('agora sim, com o motivo já respondido')
        .toBeTrue();
    });
  });
});
