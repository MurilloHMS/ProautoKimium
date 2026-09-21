import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HrReimbursementsComponent } from './hr-reimbursements.component';
import { environment } from '../../../../environments/environment';
import { providersDeTeste } from '../../../../testing/test-setup';

describe('HrReimbursementsComponent', () => {
  let component: HrReimbursementsComponent;
  let fixture: ComponentFixture<HrReimbursementsComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HrReimbursementsComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(HrReimbursementsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/hr/reimbursements/me`).flush([]);
  });

  afterEach(() => http.verify());

  function preencher(amount: string): void {
    component.form.patchValue({
      expenseDate: new Date(2026, 8, 20),
      amount,
      category: 'Restaurante',
      reason: 'Almoço com cliente',
    });
    component.selectedReceipt = new File(['%PDF-1.7'], 'nota.pdf', { type: 'application/pdf' });
  }

  /**
   * O campo era `type="number"`, que no teclado brasileiro recusa a vírgula.
   * Agora é a máscara de maquininha: os dígitos preenchem as casas da direita
   * para a esquerda, e o que chega ao formulário é o texto mascarado.
   */
  it('manda o valor como número, e não o texto com vírgula', () => {
    preencher('1.234,56');

    component.enviar();

    const req = http.expectOne(`${environment.apiUrl}/hr/reimbursements`);
    const body = req.request.body as FormData;
    expect(body.get('amount')).toBe('1234.56');
    req.flush({});
    http.expectOne(`${environment.apiUrl}/hr/reimbursements/me`).flush([]);
  });

  it('centavos sozinhos continuam valendo', () => {
    preencher('0,37');

    component.enviar();

    const req = http.expectOne(`${environment.apiUrl}/hr/reimbursements`);
    expect((req.request.body as FormData).get('amount')).toBe('0.37');
    req.flush({});
    http.expectOne(`${environment.apiUrl}/hr/reimbursements/me`).flush([]);
  });

  it('valor zerado não passa: o botão fica desligado', () => {
    preencher('0,00');

    expect(component.podeEnviar).toBeFalse();

    component.enviar();
    http.expectNone(`${environment.apiUrl}/hr/reimbursements`);
  });

  it('sem valor não passa', () => {
    preencher('');

    expect(component.podeEnviar).toBeFalse();
  });
});
