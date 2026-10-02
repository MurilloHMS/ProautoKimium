import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { EventFormComponent } from './event-form.component';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { CompanyStore } from '../../../../infrastructure/state/org-structure.store';
import { EventDetail, EventRequest } from '../../../../domain/models/events.model';
import { providersDeTeste } from '../../../../../testing/test-setup';

/** O cadastro da live: o link, a plataforma reconhecida, o horário e os avisos. */
describe('EventFormComponent · online', () => {
  let fixture: ComponentFixture<EventFormComponent>;
  let service: jasmine.SpyObj<EventsService>;
  let erros: string[];

  beforeEach(async () => {
    erros = [];
    service = jasmine.createSpyObj<EventsService>('EventsService', ['create', 'update', 'audienceOptions']);
    service.audienceOptions.and.returnValue(of({ companies: [], departments: [], employees: [] }));
    service.create.and.callFake((dados: EventRequest) => of({ id: 'novo', ...dados } as unknown as EventDetail));
    // A validação do formulário avisa com 'warn'; o erro da API, com 'error'. Os dois contam aqui.
    const messages = { add: (m: { severity: string; detail: string }) => { if (m.severity !== 'success') erros.push(m.detail); } };

    await TestBed.configureTestingModule({
      imports: [EventFormComponent],
      providers: providersDeTeste([
        { provide: EventsService, useValue: service },
        { provide: CompanyStore, useValue: { items: signal([]), load: () => {} } },
        { provide: MessageService, useValue: messages },
      ]),
    }).compileComponents();
    fixture = TestBed.createComponent(EventFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function preencher(valores: Record<string, unknown>): void {
    fixture.componentInstance.form.patchValue({
      name: 'Alinhamento semanal', startDate: '2026-10-08', endDate: '2026-10-08', locationType: 'ONLINE', ...valores,
    });
    fixture.detectChanges();
  }

  const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  it('reconhece a plataforma enquanto se digita, e some o mapa', () => {
    preencher({ onlineUrl: 'https://www.instagram.com/proautokimium/live' });

    expect(q('plataforma')!.textContent).toContain('Instagram');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-map-preview')).toBeNull();
  });

  it('link sem https avisa no campo e não salva', () => {
    preencher({ onlineUrl: 'www.youtube.com/live/abc', startTime: '09:00', endTime: '09:40' });

    expect(q('link-invalido')).not.toBeNull();
    fixture.componentInstance.salvar();
    expect(service.create).not.toHaveBeenCalled();
    expect(erros[0]).toContain('https://');
  });

  it('sem horário não salva', () => {
    preencher({ onlineUrl: 'https://meet.google.com/abc', startTime: '', endTime: '' });

    fixture.componentInstance.salvar();
    expect(service.create).not.toHaveBeenCalled();
    expect(erros[0]).toContain('horário');
  });

  it('live válida manda link, horário e os dois avisos', () => {
    preencher({ onlineUrl: '  https://meet.google.com/abc  ', startTime: '09:00', endTime: '09:40' });

    fixture.componentInstance.salvar();

    const dados = service.create.calls.mostRecent().args[0];
    expect(dados.locationType).toBe('ONLINE');
    expect(dados.onlineUrl).toBe('https://meet.google.com/abc');
    expect(dados.startTime).toBe('09:00');
    expect(dados.endTime).toBe('09:40');
    expect(dados.announceOnPublish).toBeTrue();
    expect(dados.notifyLiveStart).toBeTrue();
  });

  it('evento presencial não manda link, horário nem "começou agora", mesmo com algo digitado antes', () => {
    preencher({ onlineUrl: 'https://meet.google.com/abc', startTime: '09:00', endTime: '09:40' });
    preencher({ locationType: 'NONE' });

    fixture.componentInstance.salvar();

    const dados = service.create.calls.mostRecent().args[0];
    expect(dados.onlineUrl).toBeNull();
    expect(dados.startTime).toBeNull();
    expect(dados.notifyLiveStart).toBeFalse();
  });
});
