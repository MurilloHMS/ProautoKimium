import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { GuideComponent } from './guide.component';
import { PermissionStore } from '../../../infrastructure/state/permission.store';
import { GuideLayoutService } from '../../../infrastructure/services/guide-layout.service';
import { WebsiteProductStore } from '../../../infrastructure/state/website-product.store';
import { providersDeTeste } from '../../../../testing/test-setup';
import { FIXTURE_CATALOG, fixtureState } from './layout-editor/guide-layout.fixture';

/**
 * Uma tela, duas portas. Contratos (INCLUIR) gera guia e nunca vê o Layout —
 * um layout publicado por engano muda o guia de todo cliente. Design
 * (CONFIGURAR) não gera guia para cliente, então cai direto no Layout.
 */
describe('GuideComponent · quem vê o Gerar e quem vê o Layout', () => {

  let fixture: ComponentFixture<GuideComponent>;

  async function mount(granted: string[]): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [GuideComponent],
      providers: providersDeTeste([
        { provide: PermissionStore, useValue: { can: (_: string, p: string) => granted.includes(p), canOpen: () => true } },
        { provide: GuideLayoutService, useValue: { state: () => of(fixtureState()), catalog: () => of(FIXTURE_CATALOG) } },
        { provide: WebsiteProductStore, useValue: { items: signal([]), loading: signal(false), load: () => {} } },
      ]),
    }).compileComponents();
    fixture = TestBed.createComponent(GuideComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('Contratos (só INCLUIR) vê o Gerar, sem a troca de modo e sem o editor', async () => {
    const el = await mount(['INCLUIR', 'CONSULTAR']);
    expect(el.querySelector('pk-segmented')).toBeNull();
    expect(el.querySelector('app-guide-layout-editor')).toBeNull();
    expect(el.textContent).toContain('Gerar Guia de Utilização');
  });

  it('Design (só CONFIGURAR) cai direto no editor', async () => {
    const el = await mount(['CONFIGURAR', 'CONSULTAR']);
    expect(el.querySelector('app-guide-layout-editor')).not.toBeNull();
    expect(el.querySelector('.guide-layout')).toBeNull();
  });

  it('quem tem as duas começa no Gerar e troca para o Layout', async () => {
    const el = await mount(['INCLUIR', 'CONFIGURAR']);
    expect(el.querySelector('pk-segmented')).not.toBeNull();
    expect(el.querySelector('app-guide-layout-editor')).toBeNull();

    fixture.componentInstance.mode.set('layout');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('app-guide-layout-editor')).not.toBeNull();
    expect(el.querySelector('.guide-layout')).toBeNull();
  });
});
