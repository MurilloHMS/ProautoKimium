import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HoleriteHubComponent } from './holerite-hub.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * O Coletar entrou no hub de Holerites (2026-10-05), mas continua com a tela
 * dele na grade: quem não abria `rh/holerit/extractor` não ganha a ferramenta.
 */
describe('HoleriteHubComponent · ferramentas', () => {
  function chaves(grade: Record<string, string[]>): string[] {
    TestBed.configureTestingModule({ imports: [HoleriteHubComponent], providers: providersDeTeste() });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    return TestBed.createComponent(HoleriteHubComponent).componentInstance.ferramentas().map(f => f.key);
  }

  it('quem abre o Coletar vê as quatro ferramentas', () => {
    expect(chaves({ 'rh/holerit': ['CONSULTAR'], 'rh/holerit/extractor': ['CONSULTAR'] }))
      .toEqual(['envio', 'auditoria', 'separar', 'coletar']);
  });

  it('quem não abre o Coletar não ganha a ferramenta', () => {
    expect(chaves({ 'rh/holerit': ['CONSULTAR'] })).toEqual(['envio', 'auditoria', 'separar']);
  });
});
