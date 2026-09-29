import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Subject, of } from 'rxjs';
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
    tag: '1',
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

    // Stores reais, populados direto: `upsert` é o mesmo caminho que a tela usa
    // depois de gravar, então o estado fica idêntico ao de uso real sem HTTP.
    registerStore = TestBed.inject(MachineRegisterStore);
    machineStore = TestBed.inject(MachineStore);
    machineStore.upsert(machine);
  });

  /** Abre o formulário da linha gravada e aplica as mudanças, como a pessoa faria. */
  const editarNoForm = (stored: MachineRegister, mudanca: Partial<Record<string, unknown>>) => {
    registerStore.upsert(stored);
    component.abrirForm(component.rows()[0]);
    for (const [campo, valor] of Object.entries(mudanca)) {
      component.editarCampo(campo as never, valor as never);
    }
  };

  /**
   * **O teste que impede o atrito.**
   *
   * Reservar não é entregar: a máquina continua no galpão. Uma pergunta aqui
   * apareceria dezenas de vezes por dia sem nada a dizer.
   */
  it('mudar entre status de estoque não pergunta nada e grava direto', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.RESERVADA });

    expect(component.stockDelta()).toBe(0);
    component.salvarForm();

    expect(registerService.update).toHaveBeenCalled();
    expect(lastPayload().adjustStock).toBeUndefined();
  });

  /**
   * **O pedido desta versão:** a conta do estoque aparece no formulário
   * enquanto se edita, e não numa janela depois do "Salvar".
   */
  it('marcar ENTREGUE mostra a conta do estoque no formulário, antes de salvar', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });

    expect(component.stockDelta()).toBe(-1);
    expect(component.currentStock()).toBe(5);
    expect(component.newStock()).toBe(4);
    expect(registerService.update).not.toHaveBeenCalled();
  });

  it('salvar grava com adjustStock ligado, sem abrir mais nada', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });

    component.salvarForm();

    expect(lastPayload().adjustStock).toBeTrue();
    expect(lastPayload().status).toBe(MachineStatus.ENTREGUE);
    expect(component.formAberto()).toBeFalse();
  });

  /**
   * A opção nova: quem já acertou o estoque pela tela de movimentação só
   * atualiza a programação. Antes a única saída era cancelar a edição.
   */
  it('escolher "não mexer no estoque" grava com adjustStock desligado', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });

    component.adjustStockChoice.set(false);
    component.salvarForm();

    expect(lastPayload().adjustStock).toBeFalse();
    expect(lastPayload().status).toBe(MachineStatus.ENTREGUE);
  });

  /** O caso que ele reportou: voltar de ENTREGUE tem que devolver ao estoque. */
  it('voltar de ENTREGUE soma 1', () => {
    editarNoForm(register(MachineStatus.ENTREGUE), { status: MachineStatus.DISPONIVEL });

    expect(component.stockDelta()).toBe(1);
    expect(component.newStock()).toBe(6);
  });

  /**
   * AGUARDANDO_AQUISICAO é máquina que ainda não chegou — nunca entrou no
   * estoque, então entregá-la não pode baixar nada. É a metade da regra que
   * some quando alguém lê só "só ENTREGUE".
   */
  it('entregar o que nunca esteve em estoque não pergunta nada', () => {
    editarNoForm(register(MachineStatus.AGUARDANDO_AQUISICAO), { status: MachineStatus.ENTREGUE });

    expect(component.stockDelta()).toBe(0);
    component.salvarForm();

    expect(registerService.update).toHaveBeenCalled();
    expect(lastPayload().adjustStock).toBeUndefined();
  });

  /**
   * **Divergência que já existia não pode travar o trabalho.**
   *
   * Se o estoque em movimentações está zerado e a programação diz que há
   * máquina, a API recusaria a baixa. A opção de baixar some e a edição grava
   * só o status — mesmo que o "baixar" continue marcado por baixo.
   */
  it('estoque insuficiente grava sem mexer no estoque', () => {
    stockIs(0);
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });

    expect(component.stockWouldGoNegative()).toBeTrue();
    expect(component.adjustStockChoice()).toBeTrue();

    component.salvarForm();

    expect(lastPayload().adjustStock).toBeFalse();
    expect(lastPayload().status).toBe(MachineStatus.ENTREGUE);
  });

  /**
   * O número ainda não chegou, então ninguém o viu. Salvar aqui seria
   * confirmar uma conta que não foi mostrada — o que a pergunta existe para
   * impedir.
   */
  it('não salva enquanto o estoque ainda carrega', () => {
    inventoryService.getInventoryMovementsByProduct.and.returnValue(new Subject<never>());
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });

    expect(component.loadingStock()).toBeTrue();
    component.salvarForm();

    expect(registerService.update).not.toHaveBeenCalled();
  });

  /** Um GET por mudança de máquina, e não um por tecla digitada no formulário. */
  it('o estoque é consultado uma vez, e não a cada campo editado', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });
    component.editarCampo('status', MachineStatus.ENTREGUE);
    component.editarCampo('status', MachineStatus.ENTREGUE);

    expect(inventoryService.getInventoryMovementsByProduct).toHaveBeenCalledTimes(1);
  });

  /** Fechar é desistir: nada vai para a API, e a linha continua como estava. */
  it('fechar o formulário não grava nada', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.ENTREGUE });

    component.fecharForm();

    expect(registerService.update).not.toHaveBeenCalled();
    expect(component.rows()[0].status).toBe(MachineStatus.DISPONIVEL);
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

  // ─── O status e a máquina na criação ──────────────────────────────────────

  /**
   * **A linha nova nasce sem status e sem máquina.**
   *
   * Ela nascia em `DISPONIVEL`, e quem não reparasse criava máquina em estoque
   * e confirmava o `+1` sem querer. E nascia com a primeira máquina da lista,
   * que é a mesma armadilha com outro campo.
   */
  it('a linha nova nasce sem status e sem máquina, no formulário', () => {
    component.addRow();

    expect(component.formAberto()).toBeTrue();
    expect(component.formRascunho()?.status).toBeNull();
    expect(component.formRascunho()?.machineId).toBe('');
  });

  /** Ela vive no formulário até a API confirmar: a lista não ganha linha fantasma. */
  it('a linha nova não entra na lista antes de ser criada', () => {
    registerStore.upsert(register(MachineStatus.DISPONIVEL));

    component.addRow();

    expect(component.rows().length).toBe(1);
  });

  it('sem status escolhido, não salva', () => {
    const draft = { machineId: 'm1', status: null } as never;

    expect(component.canSaveDraft(draft)).toBeFalse();
  });

  /**
   * **O botão desabilitado não é a trava.**
   *
   * Sem a guarda do `saveDraft`, `stockDeltaFor(null, null)` dá 0 e a linha
   * cairia direto no POST com `status: null`, deixando a API decidir. O botão
   * "impede" até alguém chamar por atalho de teclado.
   */
  it('salvar uma linha nova sem status não chama a API', () => {
    component.addRow();
    component.editarCampo('machineId', MACHINE_ID);

    component.salvarForm();

    expect(registerService.create).not.toHaveBeenCalled();
  });

  /**
   * O par do de baixo, e ele existe por um motivo específico: sozinho, o outro
   * passaria se alguém "consertasse" o erro de tipo com `row.status ??
   * DISPONIVEL` — e aí toda linha nova voltaria a somar estoque.
   */
  it('criar em DISPONIVEL mostra o estoque e grava com a resposta', () => {
    component.addRow();
    component.editarCampo('machineId', MACHINE_ID);
    component.editarCampo('status', MachineStatus.DISPONIVEL);

    expect(component.stockDelta()).toBe(1);
    expect(component.newStock()).toBe(6);

    component.salvarForm();

    const payload = registerService.create.calls.mostRecent().args[0];
    expect(payload.adjustStock).toBeTrue();
  });

  /**
   * **O teste que dá sentido ao pedido dele.**
   *
   * `AGUARDANDO_AQUISICAO` é máquina que ainda não foi comprada: criar a linha
   * não pode lançar entrada. Se alguém "simplificar" a regra, máquina não
   * comprada passa a somar no estoque — e o erro só aparece na conciliação,
   * dias depois.
   */
  it('criar em AGUARDANDO_AQUISICAO grava direto, sem tocar no estoque', () => {
    component.addRow();
    component.editarCampo('machineId', MACHINE_ID);
    component.editarCampo('status', MachineStatus.AGUARDANDO_AQUISICAO);

    expect(component.stockDelta()).toBe(0);
    component.salvarForm();

    const payload = registerService.create.calls.mostRecent().args[0];
    expect(payload.adjustStock).toBeUndefined();
  });

  // ─── Excluir ──────────────────────────────────────────────────────────────

  it('excluir pergunta antes, e só confirma no botão', () => {
    registerService.delete.and.returnValue(of('ok'));
    registerStore.upsert(register(MachineStatus.RESERVADA));

    component.deleteRow(component.rows()[0]);

    expect(component.deleteTarget()).not.toBeNull();
    expect(registerService.delete).not.toHaveBeenCalled();

    component.confirmDelete();

    expect(registerService.delete).toHaveBeenCalledWith(REGISTER_ID);
  });

  /** Apagar não baixa o estoque, e quem apaga máquina do galpão precisa saber. */
  it('a pergunta avisa quando a máquina conta no estoque', () => {
    registerStore.upsert(register(MachineStatus.DISPONIVEL));
    component.deleteRow(component.rows()[0]);
    expect(component.deleteCountsInStock()).toBeTrue();

    component.deleteTarget.set({ ...component.rows()[0], status: MachineStatus.ENTREGUE });
    expect(component.deleteCountsInStock()).toBeFalse();
  });

  /** A linha nova nunca existiu no banco: descartar não pergunta nada. */
  it('descartar a linha nova fecha o formulário sem perguntar', () => {
    component.addRow();

    component.deleteRow(component.formRascunho()!);

    expect(component.formAberto()).toBeFalse();
    expect(component.deleteTarget()).toBeNull();
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

  /**
   * O clássico silencioso: sem comparar como número, 10 vem antes de 9.
   *
   * O prefixo é de propósito. A tag virou texto justamente para aceitar letra,
   * e comparar com `Number()` — o que o código fazia antes — devolveria `NaN`
   * para as três, empatando tudo e mandando a coluna inteira para o fim.
   */
  it('tag ordena como número, mesmo com letra', () => {
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'a', tag: 'T-10' });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'b', tag: 'T-2' });
    registerStore.upsert({ ...register(MachineStatus.DISPONIVEL), id: 'c', tag: 'T-9' });

    component.toggleSort('tag');

    expect(component.rows().map(r => r.id)).toEqual(['b', 'c', 'a']);
  });

  // ─── Histórico agrupado por edição ─────────────────────────────────────────

  const alteracao = (
    id: string,
    campo: string,
    anterior: string | null,
    novo: string | null,
    changedAt: string,
    motivo: string | null = null,
    changedBy: string | null = 'Murillo',
  ) => ({ id, campo, valorAnterior: anterior, valorNovo: novo, motivo, changedBy, changedAt });

  const abrirHistoricoCom = (linhas: ReturnType<typeof alteracao>[]) => {
    registerService.scheduleChanges.and.returnValue(of(linhas));
    registerStore.upsert(register(MachineStatus.DISPONIVEL));
    component.abrirHistorico(component.rows()[0]);
  };

  /**
   * **O teste que justifica a Opção B.**
   *
   * A API grava uma linha por campo. Sem agrupar, quem arrumou o cliente, o
   * técnico e a previsão de uma vez vê três cartões com a MESMA justificativa e
   * o MESMO horário repetidos — e o diálogo fica ilegível justamente na edição
   * que mais interessa consultar.
   */
  it('linhas da mesma edição viram uma entrada só', () => {
    abrirHistoricoCom([
      alteracao('1', 'previsao', '2026-09-15T00:00', '2026-09-22T00:00', '2026-08-31T14:32:00', 'Cliente pediu'),
      alteracao('2', 'tecnico', 'Marcos', 'Joana', '2026-08-31T14:32:00', 'Cliente pediu'),
    ]);

    expect(component.historicoAgrupado().length).toBe(1);
    expect(component.historicoAgrupado()[0].campos.length).toBe(2);
    expect(component.historicoAgrupado()[0].motivo).toBe('Cliente pediu');
  });

  /**
   * O par do de cima. Sozinho, o teste anterior passaria com um agrupamento que
   * junta tudo numa entrada só — e o histórico inteiro viraria um bloco.
   */
  it('edições em instantes diferentes ficam separadas', () => {
    abrirHistoricoCom([
      alteracao('1', 'previsao', '2026-09-15T00:00', '2026-09-22T00:00', '2026-08-31T14:32:00'),
      alteracao('2', 'tecnico', 'Marcos', 'Joana', '2026-08-25T09:10:00'),
    ]);

    expect(component.historicoAgrupado().length).toBe(2);
  });

  /**
   * Mesmo instante, autores diferentes. Improvável, mas a chave é autor +
   * instante justamente para isso: juntar duas pessoas numa entrada atribuiria
   * a alteração de uma à outra.
   */
  it('mesmo instante com autores diferentes não agrupa', () => {
    abrirHistoricoCom([
      alteracao('1', 'tecnico', 'Marcos', 'Joana', '2026-08-31T14:32:00', null, 'Murillo'),
      alteracao('2', 'regiao', 'Sul', 'Norte', '2026-08-31T14:32:00', null, 'Ricardo'),
    ]);

    expect(component.historicoAgrupado().length).toBe(2);
  });

  /** A ordem que a API manda é a que se lê: mais recente primeiro. */
  it('o agrupamento preserva a ordem de chegada', () => {
    abrirHistoricoCom([
      alteracao('1', 'tecnico', 'Marcos', 'Joana', '2026-08-31T14:32:00'),
      alteracao('2', 'regiao', 'Sul', 'Norte', '2026-08-25T09:10:00'),
    ]);

    expect(component.historicoAgrupado().map(e => e.changedAt))
      .toEqual(['2026-08-31T14:32:00', '2026-08-25T09:10:00']);
  });

  // ─── Cada campo no seu formato ─────────────────────────────────────────────

  /**
   * A API guarda tudo como texto numa coluna só, então a previsão chega em ISO.
   * Sem converter, o histórico mostraria `2026-09-22T00:00` — o banco falando,
   * não a tela.
   */
  it('previsão volta a ser data', () => {
    expect(component.valorDoCampo('previsao', '2026-09-22T00:00')).toBe('22/09/2026');
  });

  /**
   * O status é gravado pela CHAVE do enum de propósito, para o histórico não
   * mudar de conteúdo quando alguém corrige uma tradução. A tradução acontece
   * aqui, na leitura.
   */
  it('status volta a ser rótulo em português', () => {
    expect(component.valorDoCampo('status', 'AGUARDANDO_AQUISICAO')).toBe('Aguardando aquisição');
  });

  /** Campo de texto passa direto: não há formato a devolver. */
  it('texto passa sem tradução', () => {
    expect(component.valorDoCampo('tecnico', 'Joana Prado')).toBe('Joana Prado');
  });

  /**
   * Nulo continua nulo, e não vira "—".
   *
   * Quem desenha ausência é o template, que mostra "sem valor" apagado. Devolver
   * o traço daqui tiraria dele a chance de distinguir ausência de conteúdo, e a
   * célula em branco se lê como falha de carregamento.
   */
  it('ausência continua ausência', () => {
    expect(component.valorDoCampo('previsao', null)).toBeNull();
    expect(component.valorDoCampo('status', null)).toBeNull();
  });

  /**
   * Um campo que a API passe a gravar e a tela ainda não conheça aparece com a
   * chave crua, não some. Some seria pior: o histórico mentiria por omissão.
   */
  it('campo desconhecido aparece com a chave crua', () => {
    expect(component.rotuloDoCampo('observacao')).toBe('observacao');
    expect(component.valorDoCampo('observacao', 'qualquer coisa')).toBe('qualquer coisa');
  });

  // ─── O motivo, dentro do formulário ────────────────────────────────────────

  /**
   * **A regra que saiu antes, e continua fora.**
   *
   * Obrigar justificativa ensinava a digitar "ok" para passar da tela. O campo
   * aparece quando a previsão muda; deixar em branco grava com motivo nulo.
   */
  it('salvar sem escrever o motivo grava, com motivo nulo', () => {
    editarNoForm(
      { ...register(MachineStatus.DISPONIVEL), previsaoEntrega: '2026-09-01T00:00' },
      { previsao: new Date(2026, 8, 20) });

    expect(component.formNeedsReason()).toBeTrue();
    component.salvarForm();

    expect(registerService.update).toHaveBeenCalled();
    expect(lastPayload().motivoAlteracaoPrevisao).toBeNull();
  });

  it('o motivo escrito no formulário vai junto, num salvar só', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { tecnico: 'Joana Prado' });

    component.formReason.set('  técnico de férias  ');
    component.salvarForm();

    expect(lastPayload().motivoAlteracaoPrevisao).toBe('técnico de férias');
  });

  /**
   * O motivo vale para a edição inteira, e a API o repete em cada campo que
   * mudou — então qualquer um dos sete campos do histórico pede o campo.
   */
  it('mudar um campo de texto mostra o campo de motivo', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { tecnico: 'Joana Prado' });

    expect(component.formNeedsReason()).toBeTrue();
    expect(registerService.update).not.toHaveBeenCalled();
  });

  /**
   * **A regra do campo vazio.**
   *
   * Preencher é completar cadastro, não alterar: não há nada de onde ter saído,
   * e não há decisão a justificar.
   */
  it('preencher um campo que estava vazio não pede motivo, e o motivo nem vai', () => {
    editarNoForm({ ...register(MachineStatus.DISPONIVEL), consultor: '' }, { consultor: 'Marcos Vinícius' });

    expect(component.formNeedsReason()).toBeFalse();

    // Mesmo com algo digitado antes de a regra mudar de ideia: o que a tela
    // não perguntou, a API não recebe.
    component.formReason.set('sobrou de antes');
    component.salvarForm();

    expect(lastPayload().motivoAlteracaoPrevisao).toBeUndefined();
  });

  /**
   * Apagar CONTA. É o oposto do de cima e o par que o protege: sozinho, aquele
   * passa com uma regra que ignora tudo que envolve vazio, e aí limpar o
   * técnico de uma linha sumiria do histórico sem deixar rastro.
   */
  it('apagar um campo que tinha valor pede o motivo', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { tecnico: '' });

    expect(component.formNeedsReason()).toBeTrue();
  });

  /**
   * **O teste que preserva a decisão antiga.**
   *
   * Reservar não é entregar: um motivo a cada troca de status apareceria
   * dezenas de vezes por dia sem nada a dizer. O status continua entrando no
   * histórico — ele só não pergunta.
   */
  it('mudar só o status não pede motivo', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { status: MachineStatus.RESERVADA });

    expect(component.formNeedsReason()).toBeFalse();
  });

  /**
   * A Observação está fora do histórico por escolha do time. Perguntar o motivo
   * ali seria pedir uma justificativa que a API descarta em silêncio.
   */
  it('mexer só na observação não pede motivo', () => {
    editarNoForm(register(MachineStatus.DISPONIVEL), { Observacao: 'Entregar pela manhã' });

    expect(component.formNeedsReason()).toBeFalse();
  });

  // ─── Os chips de filtro ────────────────────────────────────────────────────

  /**
   * **Os dois recortes que não podem andar juntos.**
   *
   * Atrasada precisa de data, e sem previsão não tem: ligados ao mesmo tempo
   * davam uma lista sempre vazia, que se lê como "não há nada".
   */
  it('ligar "Atrasadas" desliga "Sem previsão", e o contrário', () => {
    component.toggleNoForecast();
    component.toggleLate();

    expect(component.onlyLate()).toBeTrue();
    expect(component.semPrevisao()).toBeFalse();

    component.toggleNoForecast();

    expect(component.semPrevisao()).toBeTrue();
    expect(component.onlyLate()).toBeFalse();
  });

  it('os chips de status somam, e o segundo toque tira', () => {
    component.toggleStatus(MachineStatus.RESERVADA);
    component.toggleStatus(MachineStatus.REFORMA);
    expect(component.statusFilter()).toEqual([MachineStatus.RESERVADA, MachineStatus.REFORMA]);

    component.toggleStatus(MachineStatus.RESERVADA);
    expect(component.statusFilter()).toEqual([MachineStatus.REFORMA]);
  });

  /** O número do chip é do quadro inteiro: não muda porque outro chip foi ligado. */
  it('a contagem do chip ignora os filtros ligados', () => {
    registerStore.upsert({ ...register(MachineStatus.RESERVADA), id: 'a' });
    registerStore.upsert({ ...register(MachineStatus.RESERVADA), id: 'b' });
    registerStore.upsert({ ...register(MachineStatus.REFORMA), id: 'c' });

    component.toggleStatus(MachineStatus.REFORMA);

    expect(component.rows().length).toBe(1);
    expect(component.statusCounts().get(MachineStatus.RESERVADA)).toBe(2);
  });

  /** "A 1042" é como a máquina é chamada no galpão: a busca tem que achar. */
  it('a busca acha pela tag', () => {
    registerStore.upsert({ ...register(MachineStatus.RESERVADA), id: 'a', tag: '1042' });
    registerStore.upsert({ ...register(MachineStatus.RESERVADA), id: 'b', tag: '877' });

    component.search = '1042';
    component.onSearch();

    expect(component.rows().map(r => r.id)).toEqual(['a']);
  });

  // ─── A cor e o nome do chip ────────────────────────────────────────────────

  /**
   * **O chip fala a língua do selo.** A cor vem do mesmo mapa de severidade
   * que pinta o status na linha: um mapa próprio para o chip divergiria do
   * selo no primeiro status novo, e o filtro verde mostraria linhas azuis.
   */
  it('cada chip de status leva a cor do selo da linha', () => {
    expect(component.statusChipClass(MachineStatus.DISPONIVEL)).toContain('chip--success');
    expect(component.statusChipClass(MachineStatus.RESERVADA)).toContain('chip--info');
    expect(component.statusChipClass(MachineStatus.AGUARDANDO_AQUISICAO)).toContain('chip--danger');
    expect(component.statusChipClass(MachineStatus.ENTREGUE)).toContain('chip--neutral');

    for (const status of Object.values(MachineStatus)) {
      const cor = component.statusClass(status).split('status-chip--')[1];
      expect(component.statusChipClass(status)).withContext(status).toContain(`chip--${cor}`);
    }
  });

  /** Os dois nomes longos encurtam no chip; os outros ficam como são. */
  it('o chip usa o nome curto só onde o longo quebrava a fileira', () => {
    expect(component.chipLabel(MachineStatus.LIBERAR_EQUIPAMENTOS)).toBe('Liberar');
    expect(component.chipLabel(MachineStatus.AGUARDANDO_AQUISICAO)).toBe('Aguardando');
    expect(component.chipLabel(MachineStatus.RESERVADA)).toBe(component.statusLabel(MachineStatus.RESERVADA));
  });

  // ─── O menu "⋯" ────────────────────────────────────────────────────────────

  /**
   * Esc fecha o de cima primeiro. Com o painel aberto e o menu por cima, um
   * Esc que fechasse o painel levaria junto o que a pessoa estava editando.
   */
  it('Esc fecha o menu e deixa o formulário aberto', () => {
    registerStore.upsert(register(MachineStatus.RESERVADA));
    component.abrirForm(component.rows()[0]);
    component.actionsOpen.set(true);

    component.onEscapeFolha();

    expect(component.actionsOpen()).toBeFalse();
    expect(component.formAberto()).toBeTrue();
  });

  it('clique fora fecha o menu', () => {
    component.actionsOpen.set(true);

    document.body.click();

    expect(component.actionsOpen()).toBeFalse();
  });

  // ─── A previsão dita como distância ────────────────────────────────────────

  const emDias = (dias: number) => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias);
  };

  const linhaCom = (previsao: Date | null, status = MachineStatus.RESERVADA) =>
    ({ ...register(status), previsao }) as never;

  it('a distância até a previsão: atrasada, hoje, amanhã, em N dias', () => {
    expect(component.relativeForecast(linhaCom(emDias(-6)))).toBe('atrasada 6 d');
    expect(component.relativeForecast(linhaCom(emDias(0)))).toBe('hoje');
    expect(component.relativeForecast(linhaCom(emDias(1)))).toBe('amanhã');
    expect(component.relativeForecast(linhaCom(emDias(17)))).toBe('em 17 dias');
    expect(component.relativeForecast(linhaCom(null))).toBe('sem previsão');
  });

  /** Entregue é passado resolvido: "atrasada" ali seria um alarme falso. */
  it('linha entregue não conta atraso', () => {
    expect(component.relativeForecast(linhaCom(emDias(-30), MachineStatus.ENTREGUE))).toBe('entregue');
  });
});
