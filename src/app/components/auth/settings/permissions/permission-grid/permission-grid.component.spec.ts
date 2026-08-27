import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PermissionGridComponent } from './permission-grid.component';
import { ScreenRow } from '../../../../../domain/models/permission-admin.model';

/**
 * A grade de 385 células.
 *
 * O que se protege aqui é o **alcance**. Uma ação em massa que mexe em mais do
 * que a pessoa está vendo não dá erro nenhum: ela grava, responde 200, e o
 * estrago aparece dias depois em quem perdeu uma tela sem saber por quê.
 */
describe('PermissionGridComponent', () => {
  let fixture: ComponentFixture<PermissionGridComponent>;
  let component: PermissionGridComponent;

  const TELAS: ScreenRow[] = [
    { code: 'stock/movements', label: 'Movimentações', module: 'Estoque', sortOrder: 10 },
    { code: 'stock/products', label: 'Produtos', module: 'Estoque', sortOrder: 20 },
    { code: 'rh/hub', label: 'Painel RH', module: 'Recursos Humanos', sortOrder: 30 },
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

  /** Quantas células estão ligadas numa tela, no estado de edição. */
  const ligadasEm = (tela: string) => component.current()[tela]?.length ?? 0;

  // ─── O alcance ────────────────────────────────────────────────────────────

  /**
   * **O teste que impede a armadilha.**
   *
   * "Liberar tudo" com um filtro ativo tem que respeitar o filtro. Se ele
   * ignorasse, alguém que filtrou "Estoque" para arrumar seis células liberaria
   * as 385 sem perceber — e a barra de gravação diria só um número grande.
   */
  it('liberar tudo respeita o filtro de módulo', () => {
    component.setModule('Estoque');
    component.toggleAll(true);

    expect(ligadasEm('stock/movements')).toBe(7);
    expect(ligadasEm('stock/products')).toBe(7);
    expect(ligadasEm('rh/hub')).withContext('fora do filtro, intocada').toBe(0);
  });

  it('a busca por texto também limita o alcance', () => {
    component.setFilter('produtos');
    component.toggleAll(true);

    expect(ligadasEm('stock/products')).toBe(7);
    expect(ligadasEm('stock/movements')).toBe(0);
  });

  /**
   * A coluna é um interruptor: se tudo já está ligado, o clique desliga. Sem
   * isso, o cabeçalho só ligaria — e desligar uma permissão inteira voltaria a
   * ser 55 cliques.
   */
  it('clicar na coluna liga e o segundo clique desliga', () => {
    component.toggleColumn('EXCLUIR');
    expect(component.current()['stock/movements']).toContain('EXCLUIR');

    component.toggleColumn('EXCLUIR');
    expect(component.current()['stock/movements'] ?? []).not.toContain('EXCLUIR');
  });

  it('o módulo liga só as telas dele', () => {
    component.toggleModule('Estoque', true);

    expect(ligadasEm('stock/movements')).toBe(7);
    expect(ligadasEm('rh/hub')).toBe(0);
  });

  // ─── O formato que vai para a API ─────────────────────────────────────────

  /**
   * `current()` devolve só o ligado — **ausente é negado**.
   *
   * É o que torna o `PUT` idempotente. Se ele mandasse as negadas também, o
   * corpo teria 385 entradas e a diferença entre "negado" e "não mandado"
   * voltaria a existir.
   */
  it('current() devolve só o que está ligado', () => {
    component.toggleCell('rh/hub:CONSULTAR');

    expect(component.current()).toEqual({ 'rh/hub': ['CONSULTAR'] });
  });

  /**
   * O código da tela tem barras, e a permissão vem depois do ÚLTIMO
   * dois-pontos. Partir no primeiro devolveria `stock` como nome de tela.
   */
  it('desmonta a chave pelo último dois-pontos', () => {
    component.toggleCell('stock/movements:ALTERAR');

    expect(Object.keys(component.current())).toEqual(['stock/movements']);
  });

  // ─── A contagem e o descarte ──────────────────────────────────────────────

  it('conta tanto o que ligou quanto o que desligou', () => {
    fixture.componentRef.setInput('saved', { 'rh/hub': ['CONSULTAR'] });
    fixture.detectChanges();

    component.toggleCell('rh/hub:CONSULTAR');      // desligou uma
    component.toggleCell('stock/products:INCLUIR'); // ligou outra

    expect(component.changed()).toBe(2);
  });

  it('descartar volta ao gravado', () => {
    fixture.componentRef.setInput('saved', { 'rh/hub': ['CONSULTAR'] });
    fixture.detectChanges();

    component.toggleAll(true);
    component.discard();

    expect(component.current()).toEqual({ 'rh/hub': ['CONSULTAR'] });
    expect(component.changed()).toBe(0);
  });

  /**
   * **Trocar de modelo ou de pessoa reinicia a edição.**
   *
   * Sem isto, abrir outro usuário mostraria as células do anterior por cima das
   * dele — e gravar escreveria as permissões erradas na pessoa errada, sem erro
   * nenhum na tela.
   */
  it('trocar o gravado reinicia a edição', () => {
    component.toggleAll(true);
    expect(component.changed()).toBeGreaterThan(0);

    fixture.componentRef.setInput('saved', { 'stock/products': ['BAIXAR'] });
    fixture.detectChanges();

    expect(component.current()).toEqual({ 'stock/products': ['BAIXAR'] });
    expect(component.changed()).toBe(0);
  });

  // ─── Só leitura ───────────────────────────────────────────────────────────

  /**
   * Quem não tem `ALTERAR` enxerga e não mexe.
   *
   * O 403 da API pegaria de qualquer jeito, mas uma grade que aceita o clique e
   * falha ao gravar faz a pessoa refazer o trabalho para descobrir isso.
   */
  it('em só leitura, nenhum clique muda nada', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    component.toggleCell('rh/hub:CONSULTAR');
    component.toggleColumn('EXCLUIR');
    component.toggleAll(true);

    expect(component.changed()).toBe(0);
  });

  // ─── O ponto âmbar ────────────────────────────────────────────────────────

  /**
   * A marca que impede o reaplicar cego.
   *
   * Ela aparece nos dois sentidos: a permissão que o carimbo deu e alguém
   * tirou, e a que ninguém carimbou e alguém ligou à mão.
   */
  it('marca as células que diferem dos carimbos, nos dois sentidos', () => {
    fixture.componentRef.setInput('saved', { 'stock/movements': ['ALTERAR'] });
    fixture.componentRef.setInput('stamped', { 'stock/movements': ['EXCLUIR'] });
    fixture.detectChanges();

    const linha = component.blocks().find(
      b => b.kind === 'screen' && b.screen.code === 'stock/movements');
    const cells = linha?.kind === 'screen' ? linha.cells : [];

    expect(cells.find(c => c.permission === 'ALTERAR')?.diverges)
      .withContext('ligada à mão, o carimbo não dava').toBeTrue();
    expect(cells.find(c => c.permission === 'EXCLUIR')?.diverges)
      .withContext('o carimbo dava, alguém tirou').toBeTrue();
    expect(cells.find(c => c.permission === 'CONSULTAR')?.diverges)
      .withContext('nem carimbo nem ajuste').toBeFalse();
  });

  /**
   * Sem carimbo nenhum não há divergência — é a tela de modelos, onde o
   * conceito não existe. Marcar tudo lá seria ruído em 385 células.
   */
  it('sem carimbo, nenhuma célula diverge', () => {
    fixture.componentRef.setInput('saved', { 'stock/movements': ['ALTERAR'] });
    fixture.componentRef.setInput('stamped', {});
    fixture.detectChanges();

    const linha = component.blocks().find(
      b => b.kind === 'screen' && b.screen.code === 'stock/movements');
    const cells = linha?.kind === 'screen' ? linha.cells : [];

    expect(cells.every(c => !c.diverges)).toBeTrue();
  });

  // ─── Módulos ──────────────────────────────────────────────────────────────

  it('a faixa do módulo traz o placar do que está ligado', () => {
    component.toggleRow(TELAS[0], true);

    const faixa = component.blocks().find(
      b => b.kind === 'module' && b.module === 'Estoque');

    expect(faixa?.kind === 'module' ? faixa.allowed : -1).toBe(7);
    expect(faixa?.kind === 'module' ? faixa.total : -1).toBe(14);
  });

  it('módulo fechado esconde as linhas e mantém a faixa', () => {
    component.collapse('Estoque');

    const blocos = component.blocks();
    expect(blocos.some(b => b.kind === 'module' && b.module === 'Estoque')).toBeTrue();
    expect(blocos.some(b => b.kind === 'screen' && b.screen.module === 'Estoque')).toBeFalse();
    expect(blocos.some(b => b.kind === 'screen' && b.screen.module === 'Recursos Humanos'))
      .withContext('fechar um módulo não fecha os outros').toBeTrue();
  });
});
