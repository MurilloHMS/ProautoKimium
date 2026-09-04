import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';

import { OrgStructureHierarchiesComponent } from './org-structure-hierarchies.component';
import { HierarchyStore } from '../../../../infrastructure/state/org-structure.store';
import { Hierarchy } from '../../../../domain/models/hr/org-structure.model';

/**
 * **A ordem da nova hierarquia já vem sugerida.**
 *
 * Mesmo defeito dos níveis de cargo: o campo abria vazio, e quem cadastrava
 * digitava 1 — então duas hierarquias terminavam na mesma posição e a escala
 * deixava de ordenar.
 *
 * Aqui pesa mais que nos níveis: o combo de hierarquia do cadastro de
 * funcionário é ordenado por `levelOrder`, então empate vira ordem arbitrária
 * numa lista que as pessoas leem esperando Diretor acima de Analista.
 */
describe('OrgStructureHierarchiesComponent · a ordem sugerida', () => {

  const hierarquia = (name: string, levelOrder: number): Hierarchy =>
    ({ id: `h-${name}`, name, levelOrder });

  async function montar(existentes: Hierarchy[]) {
    await TestBed.configureTestingModule({
      imports: [OrgStructureHierarchiesComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        {
          provide: HierarchyStore,
          useValue: {
            items: signal(existentes),
            loading: signal(false),
            load: () => {},
            refresh: () => {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrgStructureHierarchiesComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('a primeira hierarquia nasce na ordem 1', async () => {
    const tela = await montar([]);

    tela.openForm();

    expect(tela.form.get('levelOrder')!.value).toBe(1);
  });

  /** **O teste que pega o defeito.** */
  it('com hierarquias cadastradas, sugere a próxima ordem', async () => {
    const tela = await montar([
      hierarquia('Diretor', 1),
      hierarquia('Gerente', 2),
    ]);

    tela.openForm();

    expect(tela.form.get('levelOrder')!.value).toBe(3);
  });

  it('soma a partir da MAIOR ordem, não da quantidade', async () => {
    const tela = await montar([
      hierarquia('Diretor', 1),
      hierarquia('Analista', 6),
    ]);

    tela.openForm();

    expect(tela.form.get('levelOrder')!.value)
      .withContext('duas hierarquias, mas a escala já vai até 6')
      .toBe(7);
  });

  /** Sugestão, não imposição — dá para encaixar um nível no meio da escala. */
  it('a ordem continua editável', async () => {
    const tela = await montar([hierarquia('Diretor', 1)]);

    tela.openForm();
    tela.form.get('levelOrder')!.setValue(1);

    expect(tela.form.get('levelOrder')!.value).toBe(1);
    expect(tela.form.get('levelOrder')!.enabled).toBeTrue();
  });
});
