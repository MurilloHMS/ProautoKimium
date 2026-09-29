import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ProgramacaoComponent } from './programacao.component';
import { RegisterService } from '../../../../infrastructure/services/prostock/register.service';
import { MachineService } from '../../../../infrastructure/services/prostock/machine.service';
import { InventoryProductService } from '../../../../infrastructure/services/company/inventory/inventory-product.service';
import { MachineRegisterStore } from '../../../../infrastructure/state/machine-register.store';
import { MachineStatus } from '../../../../domain/models/prostock/machine.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

/**
 * **O técnico em cima** (pedido dele, 2026-09-29): é quem faz a máquina sair, e
 * precisa de destaque. Na coluna de pessoas ele é a linha principal; o
 * consultor desce para a linha de baixo, e o cabeçalho ordena pelo técnico.
 */
describe('ProgramacaoComponent · técnico em destaque', () => {
  afterEach(() => restaurarLargura());

  it('o técnico é a linha principal da coluna, e o cabeçalho ordena por ele', async () => {
    larguraDaJanela(NO_COMPUTADOR);
    const registers = jasmine.createSpyObj<RegisterService>('R', ['getAll', 'getByMachine', 'create', 'update', 'delete', 'scheduleChanges']);
    registers.getAll.and.returnValue(of([]));
    const machines = jasmine.createSpyObj<MachineService>('M', ['getAll', 'reconcile']);
    machines.getAll.and.returnValue(of([]));
    const inventory = jasmine.createSpyObj<InventoryProductService>('I', ['getInventoryProducts', 'getInventoryMovementsByProduct']);

    TestBed.configureTestingModule({
      imports: [ProgramacaoComponent],
      providers: providersDeTeste([
        { provide: RegisterService, useValue: registers },
        { provide: MachineService, useValue: machines },
        { provide: InventoryProductService, useValue: inventory },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ]),
    });
    const fixture = TestBed.createComponent(ProgramacaoComponent);
    fixture.detectChanges(false);
    await fixture.whenStable();
    TestBed.inject(MachineRegisterStore).upsert({
      id: 'r1', machineId: 'm1', nomeCliente: 'Cliente', tag: '', regiao: '', solicitante: '',
      status: MachineStatus.RESERVADA, previsaoEntrega: null,
      consultor: 'Renata Consultora', tecnico: 'Diego Técnico', Observacao: 'Aguardando frete',
    });
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);

    const el = fixture.nativeElement as HTMLElement;
    const pessoas = el.querySelectorAll('tbody tr.linha td')[4] as HTMLElement;
    expect(pessoas.querySelector('.cel__main')?.textContent?.trim()).toBe('Diego Técnico');
    expect(pessoas.querySelector('.cel__sub')?.textContent?.trim()).toBe('Renata Consultora');

    // A observação fica embaixo do status, e não mais da máquina.
    const celulas = el.querySelectorAll('tbody tr.linha td');
    expect(celulas[2].querySelector('.cel__obs')?.textContent?.trim()).toBe('Aguardando frete');
    expect(celulas[0].textContent).not.toContain('Aguardando frete');

    const cabecalho = el.querySelector('th.col-pessoas') as HTMLElement;
    expect(cabecalho.textContent).toContain('Técnico · consultor');
    (cabecalho.querySelector('button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.sortBy()?.field).toBe('tecnico');
  });
});
