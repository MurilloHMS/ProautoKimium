import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { RhHubComponent } from './rh-hub.component';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const API = environment.apiUrl;

/**
 * O Painel RH depois da reorganização (2026-10-05): é só painel. O número de
 * pendências conta os três tipos — até então o atestado ficava de fora — e
 * leva para a Pendências, não para Férias.
 */
describe('RhHubComponent · pendências', () => {
  it('soma férias, reembolsos e atestados, e o número abre a Pendências', async () => {
    await TestBed.configureTestingModule({ imports: [RhHubComponent], providers: providersDeTeste() }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RhHubComponent);
    fixture.detectChanges();

    for (const r of http.match(() => true)) {
      const pendente = r.request.params.get('status') === 'PENDING';
      if (r.request.url === `${API}/hr/vacation-requests` && pendente) r.flush([{}, {}]);
      else if (r.request.url === `${API}/hr/reimbursements` && pendente) r.flush([{}]);
      else if (r.request.url === `${API}/hr/medical-certificates` && pendente) r.flush([{}, {}, {}]);
      else if (r.request.url.includes('dashboard')) r.flush(null);
      else r.flush([]);
    }
    // Os números do Painel são campos comuns, preenchidos no subscribe: sem a
    // segunda verificação, que acusaria a mudança feita pela resposta.
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);

    const hub = fixture.componentInstance;
    expect(hub.pendingTotal).toBe(6);
    const kpi = (fixture.nativeElement as HTMLElement).querySelector('a.kpi--hero') as HTMLAnchorElement;
    expect(kpi.getAttribute('href')).toBe('/rh/pendencias');
    expect(kpi.textContent).toContain('3 atestados');
    expect((fixture.nativeElement as HTMLElement).querySelector('.shortcuts')).toBeNull();
  });
});
