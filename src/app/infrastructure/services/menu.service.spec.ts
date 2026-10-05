import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { MenuService, dobrarAcento } from './menu.service';
import { PermissionStore } from '../state/permission.store';
import { providersDeTeste } from '../../../testing/test-setup';

describe('dobrarAcento', () => {

  it('tira o acento e baixa a caixa', () => {
    expect(dobrarAcento('Férias')).toBe('ferias');
    expect(dobrarAcento('Comunicação')).toBe('comunicacao');
    expect(dobrarAcento('Permissões')).toBe('permissoes');
  });

  it('faz o texto com e sem acento virar a mesma coisa', () => {
    // É o ponto do recurso: quem digita "ferias" no teclado do celular precisa
    // achar a tela chamada "Férias".
    expect(dobrarAcento('ferias')).toBe(dobrarAcento('Férias'));
    expect(dobrarAcento('MANUTENCAO')).toBe(dobrarAcento('Manutenção'));
  });

  it('não perde letra nenhuma', () => {
    // A faixa removida é só a dos sinais soltos depois do NFD. Se ela fosse
    // larga demais, o "c" do cedilha e o "a" do til iriam junto.
    expect(dobrarAcento('ç')).toBe('c');
    expect(dobrarAcento('ã')).toBe('a');
    expect(dobrarAcento('Programação de máquinas'))
      .toBe('programacao de maquinas');
  });

  it('deixa em paz o que não tem acento', () => {
    expect(dobrarAcento('Estoque')).toBe('estoque');
    expect(dobrarAcento('rh/hub')).toBe('rh/hub');
    expect(dobrarAcento('')).toBe('');
  });

  it('sobrevive ao separador do breadcrumb', () => {
    // O breadcrumb usa "›" (U+203A), que não é letra nem sinal combinante.
    expect(dobrarAcento('RH › Aprovações › Férias'))
      .toBe('rh › aprovacoes › ferias');
  });
});

/**
 * A Pendências não tem código de tela: aparece para quem abre férias,
 * reembolsos ou atestados. Sem a regra, ela viraria item "sem tela" — e item
 * sem tela aparece para todo logado.
 */
describe('MenuService · tela que junta outras', () => {
  function labelsCom(grade: Record<string, string[]>): string[] {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: providersDeTeste() });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    return TestBed.inject(MenuService).flatItems().map(i => i.label);
  }

  it('aparece para quem abre só uma das telas que ela junta', () => {
    expect(labelsCom({ 'rh/medical-certificates': ['CONSULTAR'] })).toContain('Pendências');
  });

  it('não aparece para quem não abre nenhuma', () => {
    expect(labelsCom({ 'rh/hub': ['CONSULTAR'] })).not.toContain('Pendências');
  });
});

/**
 * Os nomes antigos das telas que se juntaram (2026-10-05). Antes, quem digitava
 * "mural" ou "cargos" via "nenhuma página encontrada".
 */
describe('MenuService · busca pelos nomes antigos', () => {
  function busca(grade: Record<string, string[]>, termo: string): string[] {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: providersDeTeste() });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(r => r.url.endsWith('/me/permissions')).flush(grade);
    return TestBed.inject(MenuService).search(termo).map(i => i.label);
  }

  it('"mural" acha Comunicados, "cargos" acha Organização, "visao de equipe" acha Ausências', () => {
    const tudo = { 'rh/announcements': ['CONSULTAR'], 'rh/career-structure': ['CONSULTAR'], 'rh/team-overview': ['CONSULTAR'] };
    expect(busca(tudo, 'mural')).toContain('Comunicados');
    expect(busca(tudo, 'cargos')).toContain('Organização');
    expect(busca(tudo, 'visao de equipe')).toContain('Ausências');
  });

  it('o nome antigo não mostra a tela para quem não tem acesso a ela', () => {
    expect(busca({ 'rh/hub': ['CONSULTAR'] }, 'mural')).not.toContain('Comunicados');
  });
});
