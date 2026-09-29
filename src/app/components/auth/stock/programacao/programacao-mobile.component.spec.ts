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
 * O calendário e o formulário são portas para a mesma linha, e a tentação é
 * cada um chamar o service direto. Quem faz isso pula as regras de uma vez: o
 * `hasChanges` que evita o PUT à toa, o `pedeMotivo` que alimenta o histórico,
 * e a conciliação de estoque.
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
     * Adiar é a edição que o histórico existe para registrar. O campo de motivo
     * aparece no próprio calendário — e não numa janela depois do "Salvar",
     * que era a segunda camada por cima da folha.
     */
    it('trocar uma data que existia mostra o motivo no calendário, e ainda não grava', () => {
      registerStore.upsert(register());

      component.abrirPrevisao(rowOf(register()));
      component.previsaoRascunho.set(new Date(2026, 9, 15));

      expect(component.dateNeedsReason())
        .withContext('adiar pelo cartão tem que mostrar o campo do motivo')
        .toBeTrue();
      expect(registerService.update)
        .withContext('nada vai para a API antes do "Salvar data"')
        .not.toHaveBeenCalled();
    });

    it('salvar a data leva o motivo junto, num toque só', () => {
      registerStore.upsert(register());

      component.abrirPrevisao(rowOf(register()));
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.dateReason.set('peça atrasada no fornecedor');
      component.confirmarPrevisao();

      expect(registerService.update).toHaveBeenCalled();
      expect(lastPayload().motivoAlteracaoPrevisao).toBe('peça atrasada no fornecedor');
      expect(lastPayload().previsaoEntrega).toContain('2026-10-15');
    });

    /** O motivo é opcional: em branco, grava com nulo. */
    it('salvar sem escrever o motivo grava do mesmo jeito', () => {
      registerStore.upsert(register());

      component.abrirPrevisao(rowOf(register()));
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.confirmarPrevisao();

      expect(registerService.update).toHaveBeenCalled();
      expect(lastPayload().motivoAlteracaoPrevisao).toBeNull();
    });

    /** Voltar ao mesmo dia no calendário não é adiar: o campo some de novo. */
    it('escolher de novo a data de antes esconde o motivo', () => {
      registerStore.upsert(register());

      component.abrirPrevisao(rowOf(register()));
      component.previsaoRascunho.set(new Date(2026, 9, 15));
      component.previsaoRascunho.set(new Date(2026, 8, 10));

      expect(component.dateNeedsReason()).toBeFalse();
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

      expect(component.dateNeedsReason()).toBeFalse();
      component.confirmarPrevisao();

      expect(registerService.update).toHaveBeenCalled();
      expect(lastPayload().motivoAlteracaoPrevisao).toBeUndefined();
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

    /**
     * Contado de HOJE, e não da data atual da linha: a linha que mais se
     * reprograma é a atrasada, e "+1 semana" sobre uma data vencida
     * continuaria vencida.
     */
    it('o atalho "em 1 semana" conta a partir de hoje', () => {
      registerStore.upsert(register());
      component.abrirPrevisao(rowOf(register()));

      component.quickDate('week');

      const hoje = new Date();
      const esperado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7);
      expect((component.previsaoRascunho() as Date).getTime()).toBe(esperado.getTime());
    });

    it('o atalho "fim do mês" cai no último dia do mês corrente', () => {
      component.quickDate('monthEnd');

      const hoje = new Date();
      const data = component.previsaoRascunho() as Date;
      expect(data.getMonth()).toBe(hoje.getMonth());
      expect(new Date(data.getFullYear(), data.getMonth(), data.getDate() + 1).getDate()).toBe(1);
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

    /** Abrir e salvar sem mexer também não: o `hasChanges` continua no caminho. */
    it('abrir e salvar sem mexer não gera PUT', () => {
      registerStore.upsert(register());

      component.abrirForm(rowOf(register()));
      component.salvarForm();

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

    /** A API não tem PATCH: os outros oito campos continuam indo. */
    it('salvar aplica na linha e manda os nove campos', () => {
      registerStore.upsert(register());

      component.abrirForm(rowOf(register()));
      component.editarCampo('tecnico', 'Outro técnico');
      component.salvarForm();

      expect(registerService.update).toHaveBeenCalled();
      expect(lastPayload().tecnico).toBe('Outro técnico');
      expect(lastPayload().nomeCliente).toBe('Cliente');
      expect(lastPayload().regiao).toBe('Sul');
      expect(lastPayload().status).toBe(MachineStatus.RESERVADA);
    });

    /**
     * **Por que este redesenho existe.**
     *
     * Mudar data e status de uma vez abria três camadas no celular: a folha, a
     * janela do motivo e, depois dela, a do estoque. Agora as duas perguntas
     * estão no formulário ao mesmo tempo, e um "Salvar" grava as duas
     * respostas.
     */
    it('mudar data e status juntos mostra motivo e estoque de uma vez, e um salvar grava tudo', () => {
      registerStore.upsert(register({ status: MachineStatus.DISPONIVEL }));

      component.abrirForm(rowOf(register({ status: MachineStatus.DISPONIVEL })));
      component.editarCampo('status', MachineStatus.ENTREGUE);
      component.editarCampo('previsao', new Date(2026, 9, 20) as never);

      expect(component.formNeedsReason()).withContext('o motivo aparece').toBeTrue();
      expect(component.stockDelta()).withContext('e o estoque também').toBe(-1);

      component.formReason.set('cliente antecipou');
      component.salvarForm();

      expect(registerService.update).toHaveBeenCalledTimes(1);
      expect(lastPayload().motivoAlteracaoPrevisao).toBe('cliente antecipou');
      expect(lastPayload().adjustStock).toBeTrue();
      expect(lastPayload().status).toBe(MachineStatus.ENTREGUE);
    });

    /**
     * Voltar o status ao que era no meio da edição tira a pergunta: sobra só o
     * que de fato vai ser gravado.
     */
    it('desfazer a troca de status no formulário tira a pergunta do estoque', () => {
      registerStore.upsert(register({ status: MachineStatus.DISPONIVEL }));

      component.abrirForm(rowOf(register({ status: MachineStatus.DISPONIVEL })));
      component.editarCampo('status', MachineStatus.ENTREGUE);
      component.editarCampo('status', MachineStatus.DISPONIVEL);

      expect(component.stockDelta()).toBe(0);
    });
  });
});
