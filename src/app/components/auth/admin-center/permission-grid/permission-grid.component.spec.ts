import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PermissionGridComponent } from './permission-grid.component';
import { ScreenRow } from '../../../../domain/models/permission-admin.model';

/**
 * A lista de permissões da administração.
 *
 * Duas coisas se protegem aqui. O **alcance**: uma ação em massa que mexe em
 * mais do que a pessoa está vendo grava, responde 200, e o estrago aparece dias
 * depois. E o **escondido**: a grade mostra só as ações que cada tela usa, e
 * o que ela não mostra tem que voltar intacto — esconder não pode virar apagar.
 */
describe('PermissionGridComponent', () => {
  let fixture: ComponentFixture<PermissionGridComponent>;
  let component: PermissionGridComponent;
  const el = () => fixture.nativeElement as HTMLElement;

  const TELAS: ScreenRow[] = [
    { code: 'stock/movements', label: 'Movimentações', module: 'Estoque', sortOrder: 10,
      actions: ['ALTERAR', 'CONSULTAR', 'INCLUIR', 'BAIXAR'] },
    { code: 'stock/products', label: 'Produtos', module: 'Estoque', sortOrder: 20,
      actions: ['ALTERAR', 'EXCLUIR', 'INCLUIR'] },
    { code: 'rh/hub', label: 'Painel RH', module: 'Recursos Humanos', sortOrder: 30,
      actions: ['CONSULTAR'] },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionGridComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('screens', TELAS);
    fixture.componentRef.setInput('saved', {});
    fixture.detectChanges();
  });

  const ligadas = (tela: string) => component.current()[tela] ?? [];

  const abrir = (modulo: string) => {
    component.toggleOpen(modulo);
    fixture.detectChanges();
  };

  /** Os rótulos dos botões de uma tela, como aparecem. */
  const botoesDe = (rotulo: string) => {
    const linha = Array.from(el().querySelectorAll<HTMLElement>('.pgrid__screen'))
      .find(li => li.querySelector('.pgrid__label')?.textContent?.trim() === rotulo);
    return Array.from(linha?.querySelectorAll<HTMLButtonElement>('.pgrid__act') ?? [])
      .map(b => b.textContent!.trim());
  };

  // ─── Só as ações que a tela usa ───────────────────────────────────────────

  /**
   * **O que tornou a grade legível.** Eram sete caixinhas em toda tela, e a
   * API só conferia um terço delas: marcar "Excluir" no Hub não fazia nada.
   */
  it('cada tela mostra só as ações que usa, com o nome por extenso', () => {
    abrir('Estoque');
    abrir('Recursos Humanos');

    // Na ordem de quem lê a tela (ver, incluir, alterar, excluir), e não na do enum.
    expect(botoesDe('Produtos')).toEqual(['Incluir', 'Alterar', 'Excluir']);
    expect(botoesDe('Painel RH')).toEqual(['Ver']);
  });

  /**
   * **Esconder não é apagar.** A pessoa tem uma célula que a grade não mostra
   * (de antes de a tela deixar de usar a ação, ou de uma tela que saiu do
   * catálogo). Salvar qualquer outra coisa não pode tirá-la.
   */
  it('o que a grade não mostra volta intacto no current()', () => {
    fixture.componentRef.setInput('saved', {
      'rh/hub': ['CONSULTAR', 'EXCLUIR'],
      'settings/permissions/users': ['ALTERAR'],
    });
    fixture.detectChanges();

    component.setModule('Recursos Humanos', false);

    expect(ligadas('rh/hub')).toEqual(['EXCLUIR']);
    expect(ligadas('settings/permissions/users')).toEqual(['ALTERAR']);
  });

  it('liberar o módulo liga só as ações que cada tela usa', () => {
    component.setModule('Estoque', true);

    expect(ligadas('stock/products')).toEqual(['ALTERAR', 'EXCLUIR', 'INCLUIR']);
    expect(ligadas('stock/products')).not.toContain('CONSULTAR');
    expect(ligadas('rh/hub')).withContext('outro módulo, intocado').toEqual([]);
  });

  // ─── O alcance ────────────────────────────────────────────────────────────

  /**
   * **O teste que impede a armadilha.** "Liberar tudo" com a busca ativa
   * respeita a busca: quem procurou "produtos" para arrumar uma tela não pode
   * liberar o módulo inteiro sem perceber.
   */
  it('a busca limita o alcance do liberar tudo do módulo', () => {
    component.setFilter('produtos');
    component.setModule('Estoque', true);

    expect(ligadas('stock/products').length).toBe(3);
    expect(ligadas('stock/movements')).withContext('fora da busca, intocada').toEqual([]);
  });

  it('buscando, os módulos com resultado abrem sozinhos', () => {
    expect(el().querySelector('.pgrid__screen')).withContext('começa tudo fechado').toBeNull();

    component.setFilter('painel');
    fixture.detectChanges();

    expect(botoesDe('Painel RH')).toEqual(['Ver']);
  });

  // ─── Estado e marcas ──────────────────────────────────────────────────────

  it('o placar do módulo conta telas com alguma ação liberada', () => {
    fixture.componentRef.setInput('saved', { 'stock/movements': ['CONSULTAR'] });
    fixture.detectChanges();

    const estoque = component.groups().find(g => g.module === 'Estoque')!;
    expect(estoque.allowed).toBe(1);
    expect(estoque.total).toBe(2);
  });

  it('marca o que difere dos modelos aplicados', () => {
    fixture.componentRef.setInput('saved', { 'stock/products': ['INCLUIR'] });
    fixture.componentRef.setInput('applied', { 'stock/products': ['INCLUIR', 'EXCLUIR'] });
    abrir('Estoque');

    const excluir = el().querySelector<HTMLButtonElement>('[aria-label="Excluir em Produtos (difere do modelo)"]');
    expect(excluir).not.toBeNull();
    expect(excluir!.hasAttribute('data-diverges')).toBeTrue();
    expect(el().querySelectorAll('[data-diverges]').length).toBe(1);
  });

  it('conta quantas células mudaram e o descartar volta ao gravado', () => {
    let contado = 0;
    component.changedCount.subscribe(n => contado = n);

    component.toggle('stock/products:EXCLUIR');
    component.toggle('rh/hub:CONSULTAR');
    fixture.detectChanges();
    expect(contado).toBe(2);

    component.discard();
    fixture.detectChanges();
    expect(contado).toBe(0);
  });

  it('só leitura não muda nada', () => {
    fixture.componentRef.setInput('disabled', true);
    component.toggle('rh/hub:CONSULTAR');
    component.setModule('Estoque', true);

    expect(component.current()).toEqual({});
  });
});
