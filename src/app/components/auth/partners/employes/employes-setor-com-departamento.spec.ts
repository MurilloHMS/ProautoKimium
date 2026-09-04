import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { EmployesComponent } from './employes.component';
import { TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { Team } from '../../../../domain/models/hr/org-structure.model';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * **O combobox de Setor diz a que departamento cada setor pertence.**
 *
 * Setor sozinho é ambíguo no cadastro do funcionário: nomes como "Produção" ou
 * "Administrativo" se repetem entre departamentos, e quem preenche a ficha não
 * tem como saber qual dos dois está escolhendo. O departamento **já vem** no
 * `Team` que a API devolve — a lista só não estava usando.
 */
describe('EmployesComponent · o combobox de Setor', () => {

  const time = (name: string, departamento: string | null): Team => ({
    id: `id-${name}`,
    name,
    department: departamento ? { id: `dep-${departamento}`, name: departamento } : (null as never),
  });

  async function montar(times: Team[]): Promise<EmployesComponent> {
    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: [
        ...providersDeTeste(),
        { provide: TeamStore, useValue: { items: signal(times), carregar: () => {}, load: () => {} } },
      ],
    }).compileComponents();

    return TestBed.createComponent(EmployesComponent).componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('mostra "setor - departamento"', async () => {
    const tela = await montar([time('Produção', 'Industrial')]);

    expect(tela.teamOptions()[0].label).toBe('Produção - Industrial');
  });

  it('separa dois setores de mesmo nome em departamentos diferentes', async () => {
    const tela = await montar([
      time('Administrativo', 'Comercial'),
      time('Administrativo', 'Industrial'),
    ]);

    const rotulos = tela.teamOptions().map(opcao => opcao.label);

    expect(rotulos).toEqual(['Administrativo - Comercial', 'Administrativo - Industrial']);
    expect(new Set(rotulos).size)
      .withContext('era exatamente isto que o rótulo antigo não distinguia')
      .toBe(2);
  });

  /**
   * Setor sem departamento não pode virar "Produção - undefined" na tela. O
   * campo é obrigatório na API, mas o rótulo é escrito para quem lê, e um
   * dado faltando não justifica mostrar lixo.
   */
  it('setor sem departamento mostra só o nome do setor', async () => {
    const tela = await montar([time('Produção', null)]);

    expect(tela.teamOptions()[0].label).toBe('Produção');
  });

  it('o valor continua sendo o id do setor', async () => {
    const tela = await montar([time('Produção', 'Industrial')]);

    expect(tela.teamOptions()[0].value)
      .withContext('mexer no rótulo não pode mexer no que é salvo')
      .toBe('id-Produção');
  });
});
