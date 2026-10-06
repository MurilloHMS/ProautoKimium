import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { NEVER, of } from 'rxjs';

import { RequestReviewComponent } from './request-review.component';
import { DocumentRequestService } from '../../../../../infrastructure/services/hr/document-request.service';
import { Recipient } from '../../../../../domain/models/hr/document-request.model';

function resposta(over: Partial<Recipient> = {}): Recipient {
  return {
    id: 'r1', requestId: 'q', requestTitle: 'Uniforme', requestInstructions: null, requestDueDate: null,
    requestStatus: 'OPEN', requestTemplateFilename: null, employeeId: 'e', employeeName: 'Ana', status: 'SUBMITTED',
    form: [
      { key: 'rg', label: 'Foto do RG', help: null, type: 'FILE', required: true, options: [], documentTypeId: 't' },
      { key: 'camisa', label: 'Camisa', help: null, type: 'CHOICE', required: true, options: ['M'], documentTypeId: null },
    ],
    answers: { camisa: 'M' }, addedAt: '2026-10-01T09:00:00', submittedAt: '2026-10-02T09:00:00',
    reviewedBy: null, reviewedAt: null, returnReason: null,
    files: [{ id: 'f1', fieldKey: 'rg', originalFilename: 'rg.pdf', uploadedAt: '2026-10-02T09:00:00' }],
    ...over,
  };
}

describe('RequestReviewComponent', () => {
  let fixture: ComponentFixture<RequestReviewComponent>;
  let service: jasmine.SpyObj<DocumentRequestService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<DocumentRequestService>('DocumentRequestService', ['downloadFile', 'approve', 'giveBack']);
    // Só a primeira chamada responde: com o defeito do ciclo, a segunda fica no
    // ar (NEVER) e o teste falha pela contagem, em vez de travar o navegador.
    let calls = 0;
    service.downloadFile.and.callFake(() => calls++ === 0
      ? of(new HttpResponse({ body: new Blob(['%PDF'], { type: 'application/pdf' }) }))
      : NEVER);
    TestBed.configureTestingModule({
      imports: [RequestReviewComponent],
      providers: [provideZonelessChangeDetection(), { provide: DocumentRequestService, useValue: service }],
    });
    fixture = TestBed.createComponent(RequestReviewComponent);
  });

  /**
   * O defeito de 2026-10-06: o efeito que abre o primeiro arquivo lia o
   * `preview`, e o fim de cada download o disparava de novo — o navegador
   * baixava o mesmo arquivo sem parar.
   */
  it('abrir uma resposta baixa o arquivo uma vez só', () => {
    fixture.componentRef.setInput('recipient', resposta());
    fixture.detectChanges();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(service.downloadFile).toHaveBeenCalledTimes(1);
    expect(service.downloadFile).toHaveBeenCalledWith('f1');
    expect(fixture.componentInstance.preview()).not.toBeNull();
  });

  it('quem só consulta vê, mas não aprova nem devolve', () => {
    fixture.componentRef.setInput('recipient', resposta());
    fixture.componentRef.setInput('canDecide', false);
    fixture.detectChanges();

    expect(fixture.componentInstance.decidable()).toBeFalse();
    fixture.componentInstance.decide('approve');
    expect(service.approve).not.toHaveBeenCalled();
  });

  it('devolver sem motivo não chama a API', () => {
    fixture.componentRef.setInput('recipient', resposta());
    fixture.componentRef.setInput('canDecide', true);
    fixture.detectChanges();

    fixture.componentInstance.reason = '   ';
    fixture.componentInstance.decide('return');
    expect(service.giveBack).not.toHaveBeenCalled();
  });
});
