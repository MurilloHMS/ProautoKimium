import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MachineHubComponent } from './machine-hub.component';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineRegister } from '../../../../domain/models/prostock/register.model';
import { MachineStatus } from '../../../../domain/models/prostock/machine.model';

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

    const machineService = jasmine.createSpyObj<MachineService>('MachineService', ['getAll', 'reconcile']);
    machineService.getAll.and.returnValue(of([]));

    const registerService = jasmine.createSpyObj<RegisterService>('RegisterService', [
      'getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges',
    ]);
    registerService.getAll.and.returnValue(of([]));

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

  const carregar = (registers: MachineRegister[]) => registers.forEach(r => registerStore.upsert(r));

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
});
