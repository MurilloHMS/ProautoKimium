import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { HrCalculatorsComponent } from './hr-calculators.component';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { PayrollCalculatorService } from '../../../../infrastructure/services/hr/payroll-calculator.service';

/**
 * **Os três campos de dinheiro desta tela.**
 *
 * Eram `type="number"`, que no teclado brasileiro recusa vírgula — ele
 * reclamou disso no reembolso em 2026-09-21, e estes três tinham o mesmo
 * defeito. Com a máscara o campo passa a entregar texto ("5,50"), e o que
 * estes testes protegem é a conversão: mandar "5,50" onde a API espera 5.5
 * seria trocar um campo que não aceita vírgula por um cálculo errado.
 */
describe('HrCalculatorsComponent · os campos de dinheiro', () => {
  let service: {
    calculateBulkFuel: jasmine.Spy;
    adjustTicketPrices: jasmine.Spy;
    calculateMealVoucher: jasmine.Spy;
  };

  async function montar() {
    service = {
      calculateBulkFuel: jasmine.createSpy('calculateBulkFuel').and.returnValue(of([])),
      adjustTicketPrices: jasmine.createSpy('adjustTicketPrices').and.returnValue(of([])),
      calculateMealVoucher: jasmine.createSpy('calculateMealVoucher').and.returnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [HrCalculatorsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PayrollCalculatorService, useValue: service },
        { provide: EmployeeStore, useValue: { items: signal([]), loading: signal(false), load: () => {}, refresh: () => {} } },
        MessageService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HrCalculatorsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('o preço do litro vai como número', async () => {
    const tela = await montar();

    tela.bulkFuelForm.patchValue({ fuelPricePerLiter: '5,50', workingDays: 22 });
    tela.calculateBulkFuel();

    expect(service.calculateBulkFuel).toHaveBeenCalledWith(
      jasmine.objectContaining({ fuelPricePerLiter: 5.5, workingDays: 22 }));
  });

  it('o novo valor da passagem vai como número', async () => {
    const tela = await montar();

    tela.adjustmentForm.patchValue({ transportType: 'MUNICIPAL_BUS', newTicketPrice: '5,00' });
    tela.adjustTicketPrices();

    expect(service.adjustTicketPrices).toHaveBeenCalledWith(
      jasmine.objectContaining({ newTicketPrice: 5 }));
  });

  it('o valor da refeição vai como número, com milhar', async () => {
    const tela = await montar();

    tela.vrForm.patchValue({ employeeId: 'f-1', mealValue: '1.234,56', workingDays: 22 });
    tela.calculateVr();

    expect(service.calculateMealVoucher).toHaveBeenCalledWith(
      jasmine.objectContaining({ mealValue: 1234.56 }));
  });

  /**
   * `Validators.min` compara o valor do campo, que agora é texto:
   * `Number('1.234,56')` é `NaN`, e `NaN >= 0.01` é falso. Sem o validador
   * próprio, o formulário recusaria todo valor com milhar e o botão ficaria
   * desligado sem explicação.
   */
  it('valor com milhar é válido, e zero não', async () => {
    const tela = await montar();

    tela.vrForm.patchValue({ employeeId: 'f-1', mealValue: '1.234,56', workingDays: 22 });
    expect(tela.vrForm.valid).toBeTrue();

    tela.vrForm.patchValue({ mealValue: '0,00' });
    expect(tela.vrForm.valid).toBeFalse();
  });
});
