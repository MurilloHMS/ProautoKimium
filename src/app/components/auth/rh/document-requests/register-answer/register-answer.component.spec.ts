import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RegisterAnswerComponent } from './register-answer.component';
import { DocumentRequestService } from '../../../../../infrastructure/services/hr/document-request.service';
import { Recipient } from '../../../../../domain/models/hr/document-request.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../../testing/test-setup';

function semAcesso(over: Partial<Recipient> = {}): Recipient {
  return {
    id: 'r1', requestId: 'q', requestTitle: 'Documentos de admissão', requestInstructions: null, requestDueDate: null,
    requestStatus: 'OPEN', requestTemplateFilename: null, employeeId: 'e', employeeName: 'Bruno Lima', status: 'PENDING',
    form: [
      { key: 'rg', label: 'Foto do RG', help: null, type: 'FILE', required: true, options: [], documentTypeId: null },
      { key: 'camisa', label: 'Camisa', help: null, type: 'CHOICE', required: true, options: ['M', 'G'], documentTypeId: null },
    ],
    answers: {}, addedAt: '2026-10-08T09:00:00', submittedAt: null, reviewedBy: null, reviewedAt: null, returnReason: null,
    files: [], hasAccess: false, registeredBy: null, ...over,
  };
}

/** A folha "Registrar resposta": o RH responde no lugar de quem não tem acesso (ou entregou em papel). */
describe('RegisterAnswerComponent', () => {
  let fixture: ComponentFixture<RegisterAnswerComponent>;
  let comp: RegisterAnswerComponent;
  let service: jasmine.SpyObj<DocumentRequestService>;
  const texto = () => document.body.textContent ?? '';

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    service = jasmine.createSpyObj<DocumentRequestService>('DocumentRequestService', ['uploadOnBehalf', 'registerOnBehalf']);
    service.uploadOnBehalf.and.returnValue(of({ id: 'f1', fieldKey: 'rg', originalFilename: 'rg-bruno.jpg', uploadedAt: '2026-10-08T10:00:00' }));
    service.registerOnBehalf.and.callFake((_id, _a, approve) => of(semAcesso({ status: approve ? 'APPROVED' : 'SUBMITTED', registeredBy: 'ana.rh' })));
    await TestBed.configureTestingModule({
      imports: [RegisterAnswerComponent],
      providers: providersDeTeste([{ provide: DocumentRequestService, useValue: service }]),
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterAnswerComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('recipient', semAcesso());
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => restaurarLargura());

  it('avisa que o RH está respondendo no lugar da pessoa, sem acesso ao portal', () => {
    expect(texto()).toContain('no lugar de Bruno');
    expect(texto()).toContain('não tem acesso ao portal');
  });

  it('falta o arquivo e a escolha: não chama a API e diz o que falta', () => {
    comp.save(false);
    expect(service.registerOnBehalf).not.toHaveBeenCalled();
    expect(comp.error()).toContain('Foto do RG');
    expect(comp.error()).toContain('Camisa');
  });

  it('o arquivo sobe pela rota do RH, e "Registrar e aprovar" manda approve=true', () => {
    const input = document.createElement('input');
    const file = new File(['%PDF'], 'rg-bruno.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file] });
    comp.onFile(comp.recipient()!.form[0], { target: input } as unknown as Event);
    comp.pick(comp.recipient()!.form[1], 'G');

    let emitido: Recipient | null = null;
    comp.registered.subscribe(r => (emitido = r));
    comp.save(true);

    expect(service.uploadOnBehalf).toHaveBeenCalledWith('r1', 'rg', file);
    expect(service.registerOnBehalf).toHaveBeenCalledWith('r1', { camisa: 'G' }, true);
    expect(emitido!.status).toBe('APPROVED');
  });

  it('"Registrar" sem aprovar manda approve=false: vai para a conferência', () => {
    fixture.componentRef.setInput('recipient', semAcesso({ files: [{ id: 'f0', fieldKey: 'rg', originalFilename: 'rg.pdf', uploadedAt: '2026-10-08T09:30:00' }] }));
    fixture.detectChanges();
    comp.pick(comp.recipient()!.form[1], 'M');

    comp.save(false);

    expect(service.registerOnBehalf).toHaveBeenCalledWith('r1', { camisa: 'M' }, false);
  });
});
