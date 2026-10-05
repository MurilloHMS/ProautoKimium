import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { EmployeeProfileComponent } from './employee-profile.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { TabsService } from '../../../../infrastructure/services/tabs.service';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const API = environment.apiUrl;
const ANA = { id: 'e1', name: 'Ana Souza', partnerCode: '9001', document: '123', email: 'a@t.com', ativo: true,
              managerCode: '', birthday: null, positionName: 'Analista', vacationBalanceDays: 18 };

describe('EmployeeProfileComponent — a ficha', () => {
  let fixture: ComponentFixture<EmployeeProfileComponent>;
  let component: EmployeeProfileComponent;
  let http: HttpTestingController;

  async function montar(grade: Record<string, string[]>, antes?: () => void): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EmployeeProfileComponent],
      providers: [...providersDeTeste(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    antes?.();
    fixture = TestBed.createComponent(EmployeeProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne(`${API}/employee`).flush([ANA]);
    // Empresas, setores, cargos e tipos de holerite: cadastros, respondem vazio.
    http.match(r => /\/(companies|teams|positions|holerite\/types)/.test(r.url)).forEach(r => r.flush([]));
    fixture.detectChanges();
  }

  /** As URLs pedidas por seção — o que a ficha buscou nesta montagem. */
  function pedidas(): string[] {
    return http.match(() => true).map(r => r.request.urlWithParams);
  }

  it('quem só tem Funcionários vê dados e carreira, e não pede nada das outras telas', async () => {
    await montar({ 'rh/employees': ['CONSULTAR'] });
    const urls = pedidas();

    expect(urls.some(u => u.includes('/hr/career-histories'))).toBeTrue();
    for (const proibida of ['/hr/reimbursements', '/hr/medical-certificates', '/hr/vacation-requests',
                            '/hr/employee-documents', '/hr/equipment-assignments', '/holerite/employee']) {
      expect(urls.some(u => u.includes(proibida))).withContext(proibida).toBeFalse();
    }
    expect(component.anchors().map(a => a.key)).toEqual(['dados', 'carreira']);
  });

  it('com todas as telas, pede cada seção pelo endpoint do funcionário', async () => {
    await montar({
      'rh/employees': ['CONSULTAR'], 'rh/employee-documents': ['CONSULTAR'], 'rh/equipment-assignments': ['CONSULTAR'],
      'rh/vacation-requests': ['CONSULTAR'], 'rh/medical-certificates': ['CONSULTAR'], 'rh/reimbursements': ['CONSULTAR'],
      'rh/holerit': ['CONSULTAR'],
    });
    const urls = pedidas();
    expect(urls).toContain(`${API}/hr/reimbursements/employee/e1`);
    expect(urls).toContain(`${API}/hr/medical-certificates/employee/e1`);
    expect(urls).toContain(`${API}/hr/equipment-assignments/employee/e1`);
    expect(urls).toContain(`${API}/holerite/employee/e1`);
    expect(urls).toContain(`${API}/hr/vacation-requests?employeeId=e1`);
    expect(urls).toContain(`${API}/hr/employee-documents?employeeId=e1`);
    expect(component.anchors().length).toBe(7);
  });

  it('uma seção que falha não derruba as outras', async () => {
    await montar({ 'rh/employees': ['CONSULTAR'], 'rh/reimbursements': ['CONSULTAR'] });
    http.expectOne(`${API}/hr/reimbursements/employee/e1`).flush({}, { status: 500, statusText: 'Erro' });
    http.expectOne(r => r.url.includes('/hr/career-histories')).flush([]);
    fixture.detectChanges();

    expect(component.reimbursements().state).toBe('error');
    expect(component.career().state).toBe('ok');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ana Souza');
  });

  it('a aba ganha o nome da pessoa', async () => {
    let rename!: jasmine.Spy;
    await montar({ 'rh/employees': ['CONSULTAR'] }, () => { rename = spyOn(TestBed.inject(TabsService), 'rename'); });
    expect(rename).toHaveBeenCalledWith(jasmine.any(String), 'Ana Souza');
  });

  it('"Editar dados" volta para Funcionários com o formulário pedido', async () => {
    await montar({ 'rh/employees': ['CONSULTAR', 'ALTERAR'] });
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/rh/employees'], { queryParams: { editar: 'e1' } });
  });
});
