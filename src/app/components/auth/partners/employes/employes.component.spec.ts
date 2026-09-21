import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployesComponent } from './employes.component';

import { providersDeTeste } from '../../../../../testing/test-setup';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { of } from 'rxjs';

describe('EmployesComponent', () => {
  let component: EmployesComponent;
  let fixture: ComponentFixture<EmployesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: providersDeTeste()
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EmployesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** `save()` só chama a API com o formulário válido; estes são os campos que ele exige. */
  function preencherObrigatorios(): void {
    component.employeToEdit = { id: 'f-1' } as never;
    component.form.get('positionLevelId')!.enable();
    component.form.patchValue({
      partnerCode: '123', name: 'Fulano', email: 'fulano@proautokimium.com.br', ativo: true,
      hierarchyId: 'h-1', companyId: 'c-1', teamId: 't-1', positionId: 'p-1', positionLevelId: 'n-1',
      hiringDate: new Date(2026, 0, 5),
    });
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  /**
   * "Valor da passagem" era `type="number"`, que no teclado brasileiro recusa
   * vírgula. Com a máscara o campo entrega texto, e o que este teste protege é
   * a conversão — mandar "4,50" onde a API espera 4.5 trocaria um campo
   * incômodo por um vale-transporte calculado errado.
   */
  it('o valor da passagem vai para a API como número', () => {
    const store = TestBed.inject(EmployeeStore);
    const update = spyOn(store, 'update').and.returnValue(of({} as never));

    preencherObrigatorios();
    component.form.patchValue({ ticketPrice: '4,50' });
    component.save();

    expect(update).toHaveBeenCalledWith(jasmine.objectContaining({ ticketPrice: 4.5 }));
  });

  it('valor da passagem em branco continua nulo', () => {
    const store = TestBed.inject(EmployeeStore);
    const update = spyOn(store, 'update').and.returnValue(of({} as never));

    preencherObrigatorios();
    component.form.patchValue({ ticketPrice: '' });
    component.save();

    expect(update).toHaveBeenCalledWith(jasmine.objectContaining({ ticketPrice: null }));
  });
});
