import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { EmployesComponent } from './employes.component';
import { HierarchyStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { Hierarchy, Team } from '../../../../domain/models/hr/org-structure.model';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * **O cadastro de funcionário passa a usar a Estrutura Organizacional.**
 *
 * Hierarquia e Departamento eram dois `enum` escritos em `employee.model.ts` —
 * sete e onze valores fixos no código. Cadastrar uma hierarquia ou um
 * departamento em Estrutura Organizacional **não os fazia aparecer aqui**,
 * porque estas listas nunca olharam para o cadastro. Foi assim que ele
 * percebeu: os departamentos que ele cadastrou não estavam na combo.
 *
 * Departamento não virou outra combo: ele **vem do Setor**. Um `Team` pertence
 * a um `Department`, então escolher o setor já decide o departamento. Guardar
 * os dois deixava o mesmo fato escrito em dois vocabulários que podiam se
 * contradizer — e o enum ainda misturava linha de negócio (`RESTAURANTES`,
 * `AUTOMOTIVO`) com departamento de verdade (`PRODUCAO`).
 */
describe('EmployesComponent · hierarquia e departamento vindos do cadastro', () => {

  const TIMES: Team[] = [
    { id: 'time-1', name: 'Produção', department: { id: 'dep-1', name: 'Industrial' } },
    { id: 'time-2', name: 'Vendas', department: { id: 'dep-2', name: 'Comercial' } },
    { id: 'time-3', name: 'Avulso', department: null as never },
  ];

  /** De propósito fora de ordem, para o teste de ordenação valer alguma coisa. */
  const HIERARQUIAS: Hierarchy[] = [
    { id: 'h-3', name: 'Analista', levelOrder: 3 },
    { id: 'h-1', name: 'Diretor', levelOrder: 1 },
    { id: 'h-2', name: 'Gerente', levelOrder: 2 },
  ];

  async function montar(): Promise<EmployesComponent> {
    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: [
        ...providersDeTeste(),
        { provide: TeamStore, useValue: { items: signal(TIMES), refresh: () => {} } },
        { provide: HierarchyStore, useValue: { items: signal(HIERARQUIAS), refresh: () => {} } },
      ],
    }).compileComponents();

    return TestBed.createComponent(EmployesComponent).componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Hierarquia ────────────────────────────────────────────────────────────

  it('lista as hierarquias do cadastro, e não sete valores fixos no código', async () => {
    const tela = await montar();

    expect(tela.hierarchyOptions().map(o => o.label))
      .toEqual(['Diretor', 'Gerente', 'Analista']);
  });

  /**
   * Hierarquia tem ordem natural — Diretor está acima de Analista. Ordenar por
   * nome esconderia isso, e é o tipo de lista que as pessoas leem de cima para
   * baixo esperando a hierarquia real.
   */
  it('ordena por levelOrder, não por nome', async () => {
    const tela = await montar();

    const ordens = tela.hierarchyOptions()
      .map(o => HIERARQUIAS.find(h => h.id === o.value)!.levelOrder);

    expect(ordens).toEqual([1, 2, 3]);
  });

  it('o formulário guarda o id da hierarquia, não o nome', async () => {
    const tela = await montar();

    tela.form.get('hierarchyId')!.setValue('h-2');

    expect(tela.form.value.hierarchyId).toBe('h-2');
  });

  it('hierarquia continua obrigatória', async () => {
    const tela = await montar();

    tela.form.get('hierarchyId')!.setValue(null);

    expect(tela.form.get('hierarchyId')!.valid).toBeFalse();
  });

  // ── Departamento, derivado do setor ───────────────────────────────────────

  it('sem setor escolhido, não mostra departamento nenhum', async () => {
    const tela = await montar();

    expect(tela.departamentoDoSetor()).toBeNull();
  });

  it('escolher o setor define o departamento', async () => {
    const tela = await montar();

    tela.form.get('teamId')!.setValue('time-1');

    expect(tela.departamentoDoSetor()).toBe('Industrial');
  });

  /** **O teste que prova que o valor acompanha.** */
  it('trocar de setor troca o departamento junto', async () => {
    const tela = await montar();

    tela.form.get('teamId')!.setValue('time-1');
    expect(tela.departamentoDoSetor()).toBe('Industrial');

    tela.form.get('teamId')!.setValue('time-2');
    expect(tela.departamentoDoSetor())
      .withContext('o departamento não pode ficar congelado no primeiro setor')
      .toBe('Comercial');
  });

  it('setor sem departamento não mostra lixo', async () => {
    const tela = await montar();

    tela.form.get('teamId')!.setValue('time-3');

    expect(tela.departamentoDoSetor()).toBeNull();
  });

  /**
   * O funcionário não guarda mais departamento próprio. Se um controle
   * `department` voltar ao formulário, ele volta a viajar no payload — e a
   * contradição que esta mudança apagou volta com ele.
   */
  it('o formulário não tem mais campo de departamento', async () => {
    const tela = await montar();

    expect(tela.form.get('department'))
      .withContext('quem decide o departamento é o setor')
      .toBeNull();
  });

  it('e não manda department no payload', async () => {
    const tela = await montar();

    tela.form.get('teamId')!.setValue('time-1');

    expect(Object.keys(tela.form.value)).not.toContain('department');
  });
});
