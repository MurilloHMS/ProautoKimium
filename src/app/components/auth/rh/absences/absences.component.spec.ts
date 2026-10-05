import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { AbsencesComponent } from './absences.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { environment } from '../../../../../environments/environment';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

const API = environment.apiUrl;

describe('AbsencesComponent', () => {
  let fixture: ComponentFixture<AbsencesComponent>;
  let component: AbsencesComponent;
  let http: HttpTestingController;

  async function montar(grade: Record<string, string[]>): Promise<void> {
    larguraDaJanela(NO_COMPUTADOR);
    await TestBed.configureTestingModule({ imports: [AbsencesComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    fixture = TestBed.createComponent(AbsencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => restaurarLargura());

  /** Os cadastros (setores, empresas, funcionários) respondem vazio. */
  function cadastros(): void {
    http.match(r => !r.url.includes('/hr/calendar') && !r.url.includes('/hr/medical-certificates')
                   && !r.url.includes('/hr/team-overview')).forEach(r => r.flush([]));
  }

  /**
   * **Atestado é dado de saúde.** Quem tem o calendário mas não a tela de
   * Atestados não pode receber atestado nenhum — nem escondido na resposta.
   */
  it('sem a tela de Atestados, a faixa não pede atestado', async () => {
    await montar({ 'rh/calendar': ['CONSULTAR'] });
    cadastros();
    http.expectOne(r => r.url === `${API}/hr/calendar`).flush([]);
    http.expectNone(r => r.url.includes('/hr/medical-certificates'));
  });

  it('com as duas telas, férias e atestados entram juntos na faixa', async () => {
    await montar({ 'rh/calendar': ['CONSULTAR'], 'rh/medical-certificates': ['CONSULTAR'] });
    cadastros();
    const inicio = component.days()[0];
    const dia = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`;
    http.expectOne(r => r.url === `${API}/hr/calendar`).flush([
      { id: 'v', eventType: 'VACATION', employeeId: 'b', employeeName: 'Bruno', teamId: null, teamName: null,
        startDate: dia, endDate: dia, status: 'APPROVED' },
    ]);
    http.expectOne(r => r.url === `${API}/hr/medical-certificates`).flush([
      { id: 'm', employeeId: 'a', employeeName: 'Ana', startDate: dia, endDate: dia, daysCount: 1, submissionType: 'FILE',
        confirmedLegible: null, originalFilename: 'a.pdf', submittedAt: dia, status: 'RECEIVED', reviewedByName: null,
        reviewedAt: null, reviewNotes: null, resubmittedAt: null, resubmitComment: null, resubmitDeadline: null, previousAttempts: [] },
    ]);
    expect(component.rows().map(r => [r.name, r.days[0]])).toEqual([['Ana', 'CERTIFICATE'], ['Bruno', 'VACATION']]);
  });

  it('se os atestados falharem, a faixa sai com as férias', async () => {
    await montar({ 'rh/calendar': ['CONSULTAR'], 'rh/medical-certificates': ['CONSULTAR'] });
    cadastros();
    http.expectOne(r => r.url === `${API}/hr/calendar`).flush([]);
    http.expectOne(r => r.url === `${API}/hr/medical-certificates`).flush({}, { status: 500, statusText: 'Erro' });
    expect(component.loading()).toBeFalse();
  });

  it('quem só tinha a Visão de Equipe vê quem está de férias, sem pedir o calendário', async () => {
    await montar({ 'rh/team-overview': ['CONSULTAR'] });
    cadastros();
    http.expectNone(r => r.url.includes('/hr/calendar'));
    http.expectOne(r => r.url === `${API}/hr/team-overview`).flush([
      { employeeId: '1', name: 'Bruno', teamId: null, teamName: null, companyId: null, companyName: null, contractType: 'CLT', availabilityStatus: 'ON_VACATION' },
      { employeeId: '2', name: 'Ana', teamId: null, teamName: null, companyId: null, companyName: null, contractType: 'CLT', availabilityStatus: 'AVAILABLE' },
    ]);
    expect(component.away().map(e => e.name)).toEqual(['Bruno']);
  });

  it('as setas andam uma semana e buscam a janela nova', async () => {
    await montar({ 'rh/calendar': ['CONSULTAR'] });
    cadastros();
    http.expectOne(r => r.url === `${API}/hr/calendar`).flush([]);
    const antes = component.days()[0].getTime();
    component.move(1);
    const req = http.expectOne(r => r.url === `${API}/hr/calendar`);
    expect(component.days()[0].getTime() - antes).toBe(7 * 86_400_000);
    expect(req.request.params.get('start')).not.toBeNull();
    req.flush([]);
  });
});
