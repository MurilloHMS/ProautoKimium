import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { OrgStructureComponent } from './org-structure.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * Cargos & Níveis entrou na Organização (2026-10-05). Cada parte mostra o que
 * a tela dela mostrava: quem só via a estrutura não pode ganhar os salários.
 */
describe('OrgStructureComponent · partes por tela', () => {
  function montar(grade: Record<string, string[]>, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [OrgStructureComponent],
      providers: [...providersDeTeste(),
                  { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    const fixture = TestBed.createComponent(OrgStructureComponent);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  }

  it('quem só vê a estrutura não ganha Cargos e níveis', () => {
    const c = montar({ 'rh/organizational-structure': ['CONSULTAR'] });
    expect(c.sections().map(s => s.key)).toEqual(['companies', 'departments', 'teams', 'hierarchies']);
  });

  it('quem só cuida de cargos abre direto em Cargos e níveis', () => {
    const c = montar({ 'rh/career-structure': ['CONSULTAR'] });
    expect(c.sections().map(s => s.key)).toEqual(['positions']);
    expect(c.activeSection()).toBe('positions');
  });

  it('o endereço antigo de Cargos & Níveis chega com ?parte=cargos e abre em Cargos', () => {
    const c = montar({ 'rh/organizational-structure': ['CONSULTAR'], 'rh/career-structure': ['CONSULTAR'] }, { parte: 'cargos' });
    expect(c.activeSection()).toBe('positions');
  });

  it('?parte=cargos sem a tela de Cargos não abre o que a pessoa não vê', () => {
    const c = montar({ 'rh/organizational-structure': ['CONSULTAR'] }, { parte: 'cargos' });
    expect(c.activeSection()).toBe('companies');
  });
});
