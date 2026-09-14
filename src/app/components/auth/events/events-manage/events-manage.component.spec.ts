import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { EventsManageComponent } from './events-manage.component';
import { EventSummary } from '../../../../domain/models/events.model';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { environment } from '../../../../../environments/environment';

import { providersDeTeste } from '../../../../../testing/test-setup';

const RASCUNHO: EventSummary = {
  id: 'ev-2', name: 'Feira Automec 2027', startDate: '2027-04-20', endDate: '2027-04-24', coverUrl: null,
  location: null, talkCount: 2, awayTalkCount: 0, publishedAt: null, updatedAt: '2026-09-14T12:05:00', updatedBy: 'murillo.henrique',
};

const PUBLICADO: EventSummary = {
  ...RASCUNHO, id: 'ev-1', name: 'Poseidon Week', startDate: '2026-09-22', endDate: '2026-09-25', publishedAt: '2026-09-14T10:00:00',
};

describe('EventsManageComponent', () => {
  let fixture: ComponentFixture<EventsManageComponent>;
  let http: HttpTestingController;
  let celular = false;

  beforeEach(() => {
    spyOn(window, 'matchMedia').and.callFake((q: string) => ({
      matches: q.includes('768') ? celular : false, media: q,
      addEventListener: () => {}, removeEventListener: () => {},
    }) as any);
  });

  async function montar(permissoes: string[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [EventsManageComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(`${environment.apiUrl}/me/permissions`).flush({ 'communication/events': permissoes });

    fixture = TestBed.createComponent(EventsManageComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/events/manage`).flush([PUBLICADO, RASCUNHO]);
    http.expectOne(`${environment.apiUrl}/speakers`).flush([]);
    await fixture.whenStable();
  }

  afterEach(() => {
    http.verify();
    celular = false;
  });

  const texto = () => fixture.nativeElement.textContent as string;
  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;

  it('no computador, planilha com rascunho e publicado, e "Novo evento" para quem inclui', async () => {
    await montar(['CONSULTAR', 'INCLUIR', 'ALTERAR']);

    expect(q('[data-testid="planilha-eventos"]')).not.toBeNull();
    expect(q('[data-testid="cartoes-eventos"]')).toBeNull();
    expect(texto()).toContain('Rascunho');
    expect(texto()).toContain('Novo evento');
  });

  it('só o rascunho tem "Publicar" na linha', async () => {
    await montar(['CONSULTAR', 'ALTERAR']);

    const linhas = [...fixture.nativeElement.querySelectorAll('[data-testid="planilha-eventos"] tbody tr')] as HTMLElement[];
    const publicar = linhas.map(l => !!l.querySelector('button[aria-label="Publicar"]'));
    const nomes = linhas.map(l => l.textContent!.includes('Feira') ? 'rascunho' : 'publicado');
    expect(nomes.filter((_, i) => publicar[i])).toEqual(['rascunho']);
  });

  it('no celular, cartões no lugar da planilha, e sem "Novo evento" — criar pede teclado', async () => {
    celular = true;
    await montar(['CONSULTAR', 'INCLUIR', 'ALTERAR']);

    expect(q('[data-testid="cartoes-eventos"]')).not.toBeNull();
    expect(q('[data-testid="planilha-eventos"]')).toBeNull();
    expect(texto()).not.toContain('Novo evento');
    expect(fixture.nativeElement.querySelectorAll('.cartao--rascunho').length).toBe(1);
  });

  it('sem INCLUIR não oferece criar', async () => {
    await montar(['CONSULTAR']);

    expect(texto()).not.toContain('Novo evento');
  });

  it('a aba Palestrantes troca a planilha', async () => {
    await montar(['CONSULTAR']);

    (q('[data-testid="secao-palestrantes"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(q('[data-testid="planilha-palestrantes"]')).not.toBeNull();
    expect(q('[data-testid="planilha-eventos"]')).toBeNull();
  });
});
