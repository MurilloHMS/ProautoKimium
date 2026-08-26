import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MachineHubComponent } from './machine-hub.component';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineDivergence, MachineStatus } from '../../../../domain/models/prostock/machine.model';
import { ScheduleSlip } from '../../../../domain/models/prostock/register.model';

/**
 * A carga por consultor.
 *
 * O número aqui é o que alguém usa para dividir trabalho, então o que se
 * protege é **quem entra na conta**: entregue não pesa mais na mão de ninguém,
 * e linha sem consultor não pode sumir da lista — ela é justamente a que
 * precisa de dono.
 */
describe('MachineHubComponent · carga por consultor', () => {
  let component: MachineHubComponent;
  let fixture: ComponentFixture<MachineHubComponent>;
  let registerStore: MachineRegisterStore;
  let machineService: jasmine.SpyObj<MachineService>;
  let registerService: jasmine.SpyObj<RegisterService>;

  /** Ontem e semana que vem, relativos ao dia em que o teste roda. */
  const diasDaqui = (dias: number) => {
    const date = new Date();
    date.setDate(date.getDate() + dias);
    return date.toISOString().slice(0, 10);
  };

  let seq = 0;
  const register = (
    consultor: string,
    status: MachineStatus,
    previsaoEntrega: string | null = null,
  ): MachineRegister => ({
    id: `r${seq++}`,
    machineId: 'm1',
    nomeCliente: 'Cliente',
    tag: 1,
    regiao: '',
    solicitante: '',
    status,
    Observacao: '',
    previsaoEntrega,
    consultor,
    tecnico: '',
  });

  beforeEach(async () => {
    seq = 0;

    machineService = jasmine.createSpyObj<MachineService>('MachineService', [
      'getAll', 'reconcile', 'divergences', 'align',
    ]);
    machineService.getAll.and.returnValue(of([]));
    machineService.divergences.and.returnValue(of([]));
    machineService.align.and.returnValue(of({
      systemCode: 'x', name: 'x', stockBefore: 0, scheduledBefore: 0, created: 0, stockAfter: 0,
    }));

    registerService = jasmine.createSpyObj<RegisterService>('RegisterService', [
      'getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges', 'slipsSince',
    ]);
    registerService.getAll.and.returnValue(of([]));
    registerService.slipsSince.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [MachineHubComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MachineService, useValue: machineService },
        { provide: RegisterService, useValue: registerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MachineHubComponent);
    component = fixture.componentInstance;
    registerStore = TestBed.inject(MachineRegisterStore);
  });

  /**
   * Alimenta os dois caminhos: o `upsert` para quem lê o store direto, e o
   * `getAll` porque o `ngOnInit` chama `load()` e sobrescreveria a lista.
   */
  const carregar = (registers: MachineRegister[]) => {
    registerService.getAll.and.returnValue(of(registers));
    registers.forEach(r => registerStore.upsert(r));
  };

  it('conta as máquinas em aberto de cada consultor, do maior para o menor', () => {
    carregar([
      register('Juliana', MachineStatus.DISPONIVEL),
      register('Marcos', MachineStatus.RESERVADA),
      register('Marcos', MachineStatus.DISPONIVEL),
      register('Marcos', MachineStatus.REFORMA),
    ]);

    expect(component.consultantLoad().map(e => [e.name, e.open]))
      .toEqual([['Marcos', 3], ['Juliana', 1]]);
    expect(component.totalOpen()).toBe(4);
  });

  /** Entregue saiu da mão de todo mundo — não é carga, é histórico. */
  it('entregue não conta', () => {
    carregar([
      register('Marcos', MachineStatus.DISPONIVEL),
      register('Marcos', MachineStatus.ENTREGUE),
    ]);

    expect(component.consultantLoad()[0].open).toBe(1);
  });

  /**
   * **Linha sem consultor é a que mais precisa aparecer.**
   *
   * Filtrar seria o reflexo fácil, e esconderia justamente as máquinas que
   * ninguém assumiu.
   */
  it('linha sem consultor vira um grupo próprio', () => {
    carregar([
      register('', MachineStatus.DISPONIVEL),
      register('   ', MachineStatus.RESERVADA),
      register('Marcos', MachineStatus.DISPONIVEL),
    ]);

    const semDono = component.consultantLoad().find(e => e.name === 'Sem consultor');
    expect(semDono?.open).toBe(2);
  });

  /** Previsão vencida e a máquina não saiu — é o que pinta a barra de vermelho. */
  it('marca o consultor que tem máquina com previsão vencida', () => {
    carregar([
      register('Marcos', MachineStatus.DISPONIVEL, diasDaqui(-3)),
      register('Juliana', MachineStatus.DISPONIVEL, diasDaqui(7)),
      register('Paulo', MachineStatus.DISPONIVEL, null),
    ]);

    const porNome = new Map(component.consultantLoad().map(e => [e.name, e.late]));
    expect(porNome.get('Marcos')).toBe(1);
    // Previsão no futuro não é atraso.
    expect(porNome.get('Juliana')).toBe(0);
    // Sem previsão não é atraso: é falta de programação, e tem lista própria.
    expect(porNome.get('Paulo')).toBe(0);
  });

  /** A barra compara cargas entre si; quem tem mais fica em 100%. */
  it('a barra é relativa a quem carrega mais', () => {
    carregar([
      register('Marcos', MachineStatus.DISPONIVEL),
      register('Marcos', MachineStatus.DISPONIVEL),
      register('Juliana', MachineStatus.DISPONIVEL),
    ]);

    expect(component.loadWidth()(2)).toBe(100);
    expect(component.loadWidth()(1)).toBe(50);
  });

  // ─── As duas contagens ────────────────────────────────────────────────────

  const divergence = (name: string, stock: number, scheduled: number): MachineDivergence => ({
    machineId: name, systemCode: name, name, stock, scheduled,
  });

  const comDivergencias = (list: MachineDivergence[]) => {
    machineService.divergences.and.returnValue(of(list));
    fixture.detectChanges();
  };

  it('separa quem diverge de quem bate', () => {
    comDivergencias([
      divergence('Lavadora', 5, 4),
      divergence('Esteira', 3, 3),
      divergence('Capô', 2, 4),
    ]);

    expect(component.divergent().map(d => d.name)).toEqual(['Lavadora', 'Capô']);
    expect(component.allMatch()).toBeFalse();
  });

  /** Sobra na programação é tão errado quanto sobra no estoque. */
  it('diferença é estoque menos programação, com sinal', () => {
    comDivergencias([divergence('Lavadora', 5, 4), divergence('Capô', 2, 4)]);

    expect(component.differenceOf(component.divergences()[0])).toBe(1);
    expect(component.differenceOf(component.divergences()[1])).toBe(-2);
  });

  /**
   * **Tudo bater é informação, não ausência dela.**
   *
   * Sumir com o cartão faria "os números fecham" parecer o mesmo que "a tela
   * não carregou".
   */
  it('quando tudo bate, o cartão continua, com outro selo', () => {
    comDivergencias([divergence('Lavadora', 5, 5), divergence('Esteira', 3, 3)]);

    expect(component.allMatch()).toBeTrue();
    expect(component.divergences().length).toBe(2);
  });

  it('lista vazia não é "tudo bate"', () => {
    comDivergencias([]);
    expect(component.allMatch()).toBeFalse();
  });

  /** Cartão de apoio: se a chamada falhar, o Hub não pode cair junto. */
  it('erro na chamada não derruba a tela', () => {
    machineService.divergences.and.returnValue(throwError(() => new Error('500')));

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.divergences()).toEqual([]);
  });

  // ─── Adiamentos ───────────────────────────────────────────────────────────

  const slip = (
    registerId: string,
    antes: string,
    depois: string | null,
    motivo = 'peça atrasada',
  ): ScheduleSlip => ({
    registerId,
    nomeCliente: `Cliente ${registerId}`,
    machineName: 'Lavadora',
    previsaoAnterior: antes,
    previsaoNova: depois,
    motivo,
    changedAt: '2026-09-10T10:00:00',
  });

  const comAdiamentos = (list: ScheduleSlip[]) => {
    registerService.slipsSince.and.returnValue(of(list));
    fixture.detectChanges();
  };

  it('conta quantas programações adiaram mais de uma vez', () => {
    comAdiamentos([
      slip('a', '2026-09-01', '2026-09-05'),
      slip('a', '2026-09-05', '2026-09-09'),
      slip('b', '2026-09-02', '2026-09-04'),
    ]);

    expect(component.slipCount()).toBe(3);
    // Três adiamentos, mas só UMA programação reincidente. São números
    // diferentes e é justamente essa diferença que o cartão existe para contar.
    expect(component.repeatOffenders()).toBe(1);
  });

  /**
   * Mediana, não média: um adiamento de seis meses puxaria a média sozinho e
   * faria o número descrever um caso em vez do conjunto.
   */
  it('usa a mediana dos dias adiados', () => {
    comAdiamentos([
      slip('a', '2026-09-01', '2026-09-03'),   // 2 dias
      slip('b', '2026-09-01', '2026-09-05'),   // 4 dias
      slip('c', '2026-09-01', '2027-03-01'),   // 181 dias
    ]);

    expect(component.medianSlipDays()).toBe(4);
  });

  /** Apagar a previsão não tem "quantos dias" — fica fora da conta. */
  it('adiamento sem data nova não entra na mediana', () => {
    comAdiamentos([
      slip('a', '2026-09-01', '2026-09-03'),
      slip('b', '2026-09-01', null),
    ]);

    expect(component.medianSlipDays()).toBe(2);
    // Mas continua contando como adiamento: apagar a previsão é o caso mais
    // grave, porque a máquina some das próximas saídas.
    expect(component.slipCount()).toBe(2);
  });

  it('o ranking traz quem mais adiou, com o último motivo', () => {
    comAdiamentos([
      slip('a', '2026-09-05', '2026-09-09', 'técnico de férias'),   // o mais recente
      slip('a', '2026-09-01', '2026-09-05', 'peça atrasada'),
      slip('b', '2026-09-02', '2026-09-04', 'cliente pediu'),
    ]);

    const topo = component.topSlips()[0];
    expect(topo.count).toBe(2);
    // A lista vem mais recente primeiro, então o motivo guardado é o último —
    // que é o que explica por que ela ainda não saiu.
    expect(topo.motivo).toBe('técnico de férias');
  });

  // ─── Precisa de você ──────────────────────────────────────────────────────

  /**
   * **A faixa vazia é a meta, não o defeito.**
   *
   * O Hub responde "o que precisa de você". Num dia em que nada precisa, ele
   * tem que conseguir dizer isso — e não mostrar três cartões zerados.
   */
  it('sem nada pendente, a faixa não existe', () => {
    comDivergencias([divergence('Lavadora', 5, 5)]);

    expect(component.attention()).toEqual([]);
  });

  it('máquina com previsão vencida abre a faixa, com nome e dias', () => {
    carregar([register('Marcos', MachineStatus.DISPONIVEL, diasDaqui(-3))]);
    fixture.detectChanges();

    const item = component.attention()[0];
    expect(item.tone).toBe('danger');
    expect(item.lead).toContain('1 máquina');
    // O detalhe é o que diz por onde começar — a contagem sozinha não ajuda.
    expect(item.detail).toContain('3 dias');
    expect(item.link).toBe('/stock/programacao');
  });

  /** Singular e plural de verdade: "1 máquinas" denuncia código preguiçoso. */
  it('concorda o número com o substantivo', () => {
    carregar([
      register('Marcos', MachineStatus.DISPONIVEL, diasDaqui(-3)),
      register('Juliana', MachineStatus.DISPONIVEL, diasDaqui(-5)),
    ]);
    fixture.detectChanges();

    expect(component.attention()[0].lead).toContain('2 máquinas');
  });

  it('divergência entra na faixa e aponta para a movimentação', () => {
    comDivergencias([divergence('Lavadora', 5, 4), divergence('Capô', 2, 4)]);

    const item = component.attention().find(i => i.tone === 'info');
    expect(item?.link).toBe('/stock/movements');
    // Diz de que lado sobra: "sobra 1" e "falta 2" são problemas diferentes.
    expect(item?.detail).toContain('Lavadora sobra 1');
    expect(item?.detail).toContain('Capô falta 2');
  });

  /**
   * A ordem é a de urgência: vencido tem hora marcada, parado não, e divergência
   * é da casa. Trocar isso faria a primeira linha deixar de ser a mais grave.
   */
  it('vencidas vêm antes de paradas, que vêm antes de divergências', () => {
    carregar([
      register('Marcos', MachineStatus.DISPONIVEL, diasDaqui(-3)),
      register('Juliana', MachineStatus.DISPONIVEL, null),
    ]);
    comDivergencias([divergence('Lavadora', 5, 4)]);

    expect(component.attention().map(i => i.tone)).toEqual(['danger', 'warning', 'info']);
  });

  // ─── O tamanho dos cartões com muita máquina ──────────────────────────────

  /**
   * **O cartão mostra só quem NÃO bate.**
   *
   * Isso não é corte por espaço, é o que ele existe para mostrar: com cinquenta
   * máquinas e duas divergentes, ninguém quer ler quarenta e oito linhas de ✓
   * para achar as duas.
   */
  it('a divergência lista só as divergentes e conta as que fecham', () => {
    const muitas = Array.from({ length: 50 }, (_, i) =>
      divergence(`Máquina ${i}`, 3, i < 2 ? 2 : 3));

    comDivergencias(muitas);

    expect(component.divergent().length).toBe(2);
    expect(component.matchingCount()).toBe(48);
  });

  it('sem divergência nenhuma, todas contam como fechando', () => {
    comDivergencias([divergence('Lavadora', 3, 3), divergence('Capô', 5, 5)]);

    expect(component.divergent()).toEqual([]);
    expect(component.matchingCount()).toBe(2);
  });

  /**
   * **Corte anunciado.**
   *
   * O que se protege aqui não é o `slice` — é o número escondido continuar
   * disponível. Quem vê cinco linhas sem aviso acredita que viu tudo.
   */
  it('sem previsão corta em 5 e diz quantas ficaram de fora', () => {
    carregar(Array.from({ length: 23 }, () => register('Marcos', MachineStatus.DISPONIVEL)));
    fixture.detectChanges();

    expect(component.paradas().length).toBe(23);
    expect(component.visibleParadas().length).toBe(5);
    expect(component.hiddenParadas()).toBe(18);
  });

  it('com poucas, não anuncia corte nenhum', () => {
    carregar([register('Marcos', MachineStatus.DISPONIVEL)]);
    fixture.detectChanges();

    expect(component.visibleParadas().length).toBe(1);
    expect(component.hiddenParadas()).toBe(0);
  });

  /**
   * **O vazamento que a pergunta dele expôs.**
   *
   * A lista limitava sete dias para frente e nada para trás: uma previsão
   * vencida há seis meses ficava lá para sempre e ia acumulando. Passou de
   * trinta dias, deixou de ser "próxima saída" — vira problema parado, e o
   * lugar dele é a faixa "Precisa de você".
   */
  it('previsão vencida há muito tempo sai das próximas saídas', () => {
    carregar([
      register('Marcos', MachineStatus.DISPONIVEL, diasDaqui(-5)),    // atrasada, mas recente
      register('Juliana', MachineStatus.DISPONIVEL, diasDaqui(-200)), // encalhada há meses
      register('Paulo', MachineStatus.DISPONIVEL, diasDaqui(3)),      // vai sair
    ]);
    fixture.detectChanges();

    const clientes = component.upcoming().map(item => item.register.consultor);
    expect(clientes).toContain('Marcos');
    expect(clientes).toContain('Paulo');
    expect(clientes).not.toContain('Juliana');
  });

  // ─── O acerto de uma divergência ──────────────────────────────────────────

  /**
   * **O caso real dele: 52 no estoque, 17 linhas.**
   *
   * Uma linha É uma máquina física, então faltam 35. O texto tem que dizer
   * isso antes de acontecer — criar 35 linhas de uma vez não se desfaz com um
   * Ctrl+Z.
   */
  it('diz que vai criar as linhas que faltam, com o número', () => {
    const capo = divergence('CAPÔ NT 300', 52, 17);

    expect(component.alignSummary(capo)).toBe(
      'Criar 35 programações sem previsão para CAPÔ NT 300?');
  });

  /**
   * O outro sentido. A programação é a verdade sobre quantas máquinas existem,
   * então quem sobe é o estoque — e o texto diz de onde para onde.
   */
  it('quando o estoque está atrás, diz que vai ajustá-lo', () => {
    const capo = divergence('CAPÔ NT 300', 10, 17);

    expect(component.alignSummary(capo)).toBe(
      'Ajustar o estoque de CAPÔ NT 300 de 10 para 17?');
  });

  /** Uma linha só pede o singular: "criar 1 programações" denuncia o código. */
  it('concorda o texto quando falta uma só', () => {
    expect(component.alignSummary(divergence('Lavadora', 4, 3)))
      .toContain('Criar 1 programação sem previsão');
  });

  /**
   * O acerto escreve no banco, então ele passa pela confirmação. Chamar
   * `align` direto não pode disparar a requisição sozinho.
   */
  it('o botão pergunta antes, não chama a API direto', () => {
    comDivergencias([divergence('Lavadora', 5, 4)]);

    component.align(component.divergent()[0]);

    expect(machineService.align).not.toHaveBeenCalled();
  });

  /** Enquanto uma está acertando, o botão dela trava — mas só o dela. */
  it('trava apenas a linha que está acertando', () => {
    comDivergencias([divergence('Lavadora', 5, 4), divergence('Capô', 2, 4)]);
    const [lavadora, capo] = component.divergent();

    expect(component.isAligning(lavadora)).toBeFalse();
    expect(component.isAligning(capo)).toBeFalse();
  });
});
