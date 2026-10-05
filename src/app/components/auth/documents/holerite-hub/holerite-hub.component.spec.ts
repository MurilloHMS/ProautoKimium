import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HoleriteHubComponent } from './holerite-hub.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * O Coletar entrou no hub de Holerites (2026-10-05), mas continua com a tela
 * dele na grade: quem não abria `rh/holerit/extractor` não ganha a ferramenta.
 */
describe('HoleriteHubComponent · ferramentas', () => {
  function montar(grade: Record<string, string[]>, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [HoleriteHubComponent],
      providers: [...providersDeTeste(),
                  { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    const hub = TestBed.createComponent(HoleriteHubComponent).componentInstance;
    hub.ngOnInit();
    return hub;
  }

  function chaves(grade: Record<string, string[]>): string[] {
    return montar(grade).ferramentas().map(f => f.key);
  }

  it('quem abre o Coletar vê as quatro ferramentas', () => {
    expect(chaves({ 'rh/holerit': ['CONSULTAR'], 'rh/holerit/extractor': ['CONSULTAR'] }))
      .toEqual(['envio', 'auditoria', 'separar', 'coletar']);
  });

  it('quem não abre o Coletar não ganha a ferramenta', () => {
    expect(chaves({ 'rh/holerit': ['CONSULTAR'] })).toEqual(['envio', 'auditoria', 'separar']);
  });

  /**
   * O menu novo (2026-10-05) leva todo mundo para cá. Quem só tinha o Coletar
   * não pode ganhar o envio dos holerites — e tem que abrir direto no Coletar.
   */
  it('quem só tem o Coletar vê só o Coletar, e a tela já abre nele', () => {
    const hub = montar({ 'rh/holerit/extractor': ['CONSULTAR'] });
    expect(hub.ferramentas().map(f => f.key)).toEqual(['coletar']);
    expect(hub.ativa()).toBe('coletar');
  });

  it('o endereço antigo do Coletar chega com ?ferramenta=coletar e abre nele', () => {
    const hub = montar({ 'rh/holerit': ['CONSULTAR'], 'rh/holerit/extractor': ['CONSULTAR'] }, { ferramenta: 'coletar' });
    expect(hub.ativa()).toBe('coletar');
  });
});
