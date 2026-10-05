import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { CommunicationsComponent } from './communications.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const API = environment.apiUrl;

describe('CommunicationsComponent', () => {
  let fixture: ComponentFixture<CommunicationsComponent>;
  let component: CommunicationsComponent;
  let http: HttpTestingController;

  async function montar(grade: Record<string, string[]>): Promise<void> {
    await TestBed.configureTestingModule({ imports: [CommunicationsComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    fixture = TestBed.createComponent(CommunicationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // O mural e o cadastro de pessoas, quando a tela os pede.
    http.match(() => true).forEach(r => r.flush([]));
  }

  function preencher(text = 'Texto do comunicado'): void {
    component.form.patchValue({ title: 'Reunião geral', text });
  }

  it('quem só tem o Mural vê só o mural, e publica no endpoint do mural', async () => {
    await montar({ 'rh/announcements': ['CONSULTAR', 'INCLUIR'] });
    expect(component.channels()).toEqual(['MURAL']);

    preencher();
    component.send();
    const req = http.expectOne(r => r.method === 'POST' && r.url === `${API}/hr/announcements`);
    expect(req.request.body).toEqual({ title: 'Reunião geral', content: 'Texto do comunicado' });
    req.flush({});
    http.expectOne(r => r.method === 'GET' && r.url === `${API}/hr/announcements`).flush([]);
    http.expectNone(`${API}/hr/notifications`);
  });

  it('quem só tem Notificações vê só o sino, e não carrega o mural', async () => {
    await montar({ 'rh/notifications': ['CONSULTAR', 'ENVIAR'] });
    expect(component.channels()).toEqual(['BELL']);
    expect(component.channel()).toBe('BELL');
    expect(component.canReadMural()).toBeFalse();
  });

  it('o sino para pessoas escolhidas exige pelo menos uma; para todos manda employeeIds nulo', async () => {
    await montar({ 'rh/notifications': ['ENVIAR'] });
    preencher('Curto');
    expect(component.canSend).toBeFalse();

    component.setAudience('all');
    expect(component.canSend).toBeTrue();
    component.send();
    const req = http.expectOne(`${API}/hr/notifications`);
    expect(req.request.body.employeeIds).toBeNull();
    req.flush({ notified: 80, skippedNoAccount: 3 });
    expect(component.lastResult()?.notified).toBe(80);
  });

  it('o limite do texto acompanha o canal: 4000 no mural, 500 no sino', async () => {
    await montar({ 'rh/announcements': ['INCLUIR'], 'rh/notifications': ['ENVIAR'] });
    preencher('x'.repeat(600));
    expect(component.form.controls.text.valid).toBeTrue();

    component.setChannel('BELL');
    expect(component.form.controls.text.valid).toBeFalse();

    component.setChannel('MURAL');
    expect(component.form.controls.text.valid).toBeTrue();
  });
});
