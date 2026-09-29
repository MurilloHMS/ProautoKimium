import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DocumentTypesComponent } from './document-types.component';
import { environment } from '../../../../../../environments/environment';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../../testing/test-setup';

const TYPES_API = `${environment.apiUrl}/hr/employee-document-types`;

describe('DocumentTypesComponent', () => {
  let fixture: ComponentFixture<DocumentTypesComponent>;
  let component: DocumentTypesComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    larguraDaJanela(NO_COMPUTADOR);
    TestBed.configureTestingModule({ imports: [DocumentTypesComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(DocumentTypesComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges(false);
    http.match(() => true).forEach(req => req.flush([]));
  });

  afterEach(() => restaurarLargura());

  it('aceita "60, 15" de uma vez, do maior para o menor, sem repetir', () => {
    component.create();
    component.dayInput.set('15, 60 30');
    component.addDays();
    component.dayInput.set('30');
    component.addDays();

    expect(component.days()).toEqual([60, 30, 15]);
  });

  /** "0 dias antes" é o próprio vencimento, que tem a chave dele. */
  it('recusa zero, negativo e texto, sem mexer nos dias', () => {
    component.create();
    for (const invalid of ['0', '-5', 'abc', '2.5']) {
      component.dayInput.set(invalid);
      component.addDays();
      expect(component.error()).withContext(invalid).not.toBeNull();
    }
    expect(component.days()).toEqual([30]);
  });

  /** Perder o "15" porque ninguém apertou Enter seria uma pegadinha. */
  it('o que ficou digitado entra ao salvar', () => {
    component.create();
    component.name.set('NR-35');
    component.dayInput.set('15');
    component.save();

    const req = http.expectOne(TYPES_API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.alertDaysBefore).toEqual([30, 15]);
  });

  it('editar manda PUT para o tipo aberto', () => {
    component.edit({ id: 't1', name: 'ASO', alertDaysBefore: [30], notifyOnExpiry: true, recipientEmployeeIds: [], active: true });
    component.save();

    expect(http.expectOne(`${TYPES_API}/t1`).request.method).toBe('PUT');
  });

  /** A frase é o que traduz "60, 15" em "quem recebe o quê, e quando". */
  it('sem responsável, a prévia diz que ninguém recebe', () => {
    component.create();
    expect(component.preview()).toContain('Ninguém recebe o aviso');
  });

  it('sem dias e sem aviso no dia, a prévia diz que não há aviso', () => {
    component.create();
    component.days.set([]);
    component.notifyOnExpiry.set(false);
    expect(component.preview()).toContain('Sem aviso');
  });

  it('rodar avisos agora chama a API e diz quantos avisaram', () => {
    component.runAlerts();
    const req = http.expectOne(`${environment.apiUrl}/hr/employee-document-alerts/run`);
    expect(req.request.method).toBe('POST');
    req.flush({ alerted: 2 });

    expect(component.runResult()).toContain('2 documentos geraram aviso');
    expect(component.running()).toBeFalse();
  });

  /** Zero não é erro: a frase explica os dois motivos, que é a pergunta seguinte. */
  it('nenhum aviso explica por quê', () => {
    component.runAlerts();
    http.expectOne(`${environment.apiUrl}/hr/employee-document-alerts/run`).flush({ alerted: 0 });

    expect(component.runResult()).toContain('Nenhum aviso agora');
  });

  it('o resumo da lista: dias, só no dia, sem aviso ou inativo', () => {
    const base = { id: 't', name: 'X', recipientEmployeeIds: [], active: true };
    expect(component.summary({ ...base, alertDaysBefore: [60, 15], notifyOnExpiry: true })).toBe('60 · 15 dias');
    expect(component.summary({ ...base, alertDaysBefore: [], notifyOnExpiry: true })).toBe('só no dia');
    expect(component.summary({ ...base, alertDaysBefore: [], notifyOnExpiry: false })).toBe('sem aviso');
    expect(component.summary({ ...base, alertDaysBefore: [30], notifyOnExpiry: true, active: false })).toBe('inativo');
  });
});
