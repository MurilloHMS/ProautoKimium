import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { LinkDocumentComponent } from './link-document.component';
import { environment } from '../../../../../../environments/environment';
import { EmployeeDocument, EmployeeDocumentType } from '../../../../../domain/models/hr/employee-document.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/employee-documents`;

const ASO: EmployeeDocumentType = {
  id: 't-aso', name: 'ASO', alertDaysBefore: [30, 7], notifyOnExpiry: true, recipientEmployeeIds: [], active: true,
};
const OLD_NR: EmployeeDocumentType = { ...ASO, id: 't-old', name: 'NR antiga', active: false };

const ACTIVE_ASO = {
  id: 'aso-2025', employeeId: 'e1', typeId: 't-aso', title: 'ASO 2025', status: 'EXPIRING', dueDate: '2026-10-12',
} as EmployeeDocument;

/**
 * O vínculo. O que se protege: o substituto se sugere sozinho (e marcado), a
 * data vai sem fuso, e nada vai para a API sem funcionário, tipo e arquivo.
 */
describe('LinkDocumentComponent', () => {
  let fixture: ComponentFixture<LinkDocumentComponent>;
  let component: LinkDocumentComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    larguraDaJanela(NO_COMPUTADOR);
    TestBed.configureTestingModule({ imports: [LinkDocumentComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(LinkDocumentComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('types', [ASO, OLD_NR]);
    fixture.componentRef.setInput('documents', [ACTIVE_ASO]);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges(false);
    http.match(() => true).forEach(req => req.flush([]));
  });

  afterEach(() => restaurarLargura());

  const pdf = () => new File(['x'], 'aso.pdf', { type: 'application/pdf' });

  it('tipo desativado não aparece para documento novo', () => {
    expect(component.typeOptions().map(o => o.value)).toEqual(['t-aso']);
  });

  /**
   * **O teste que justifica o aviso.** Esquecer de marcar deixaria o ASO velho
   * gerando aviso de vencimento para sempre — por isso ele vem marcado.
   */
  it('funcionário com documento ativo do mesmo tipo sugere substituir, já marcado', () => {
    component.employeeId.set('e1');
    component.pickType('t-aso');

    expect(component.replaceable()?.id).toBe('aso-2025');
    expect(component.replace()).toBeTrue();
  });

  it('o substituído vai para a API; desmarcado, não vai', () => {
    component.employeeId.set('e1');
    component.pickType('t-aso');
    component.file.set(pdf());
    component.hasDueDate.set(false);

    component.save();
    let form = http.expectOne(API).request.body as FormData;
    expect(form.get('replacesId')).toBe('aso-2025');

    component.saving.set(false);
    component.replace.set(false);
    component.save();
    form = http.match(API)[0].request.body as FormData;
    expect(form.get('replacesId')).toBeNull();
  });

  it('outro funcionário não tem o que substituir', () => {
    component.employeeId.set('e9');
    component.pickType('t-aso');
    expect(component.replaceable()).toBeNull();
  });

  /** O título acompanha o tipo até a pessoa escrever o dela. */
  it('o título segue o tipo até ser editado', () => {
    component.pickType('t-aso');
    expect(component.title()).toBe('ASO');

    component.editTitle('ASO periódico 2026');
    component.pickType('t-old');
    expect(component.title()).toBe('ASO periódico 2026');
  });

  it('sem arquivo, ou com vencimento ligado e sem data, não salva', () => {
    component.employeeId.set('e1');
    component.pickType('t-aso');
    expect(component.canSave()).withContext('sem arquivo').toBeFalse();

    component.file.set(pdf());
    expect(component.canSave()).withContext('vencimento ligado, sem data').toBeFalse();

    component.hasDueDate.set(false);
    expect(component.canSave()).toBeTrue();
  });

  /** "+1 ano" conta de hoje, e a data vai como `yyyy-MM-dd` — meia-noite local não vira o dia anterior. */
  it('+1 ano conta de hoje e vai sem fuso', () => {
    component.employeeId.set('e9');
    component.pickType('t-aso');
    component.file.set(pdf());
    component.quickDue(12);

    const today = new Date();
    const expected = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    expect(component.isQuickDue(12)).toBeTrue();

    component.save();
    const form = http.expectOne(API).request.body as FormData;
    const pad = (n: number) => `${n}`.padStart(2, '0');
    expect(form.get('dueDate')).toBe(`${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`);
  });

  it('reabrir começa do zero', () => {
    component.employeeId.set('e1');
    component.file.set(pdf());
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges(false);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges(false);

    expect(component.employeeId()).toBeNull();
    expect(component.file()).toBeNull();
  });

  it('o "Substituir" chega preenchido', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges(false);
    fixture.componentRef.setInput('preset', { employeeId: 'e1', typeId: 't-aso', replacesId: 'aso-2025' });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges(false);

    expect(component.employeeId()).toBe('e1');
    expect(component.title()).toBe('ASO');
    expect(component.replaceable()?.id).toBe('aso-2025');
  });
});
