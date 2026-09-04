import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';

import { CareerStructureComponent } from './career-structure.component';
import { PositionStore, PositionLevelStore } from '../../../../infrastructure/state/position.store';

/**
 * **A ordem do novo nível já vem sugerida.**
 *
 * O campo abria vazio, e quem cadastrava digitava 1 de novo — então Júnior e
 * Pleno terminavam os dois na ordem 1, e a lista deixava de ter ordem.
 *
 * É **sugestão, não trava**: o campo continua editável, porque encaixar um
 * nível no meio da escala é uma coisa legítima de se querer fazer.
 */
describe('CareerStructureComponent · a ordem sugerida do nível', () => {

  const CARGO = { id: 'cargo-1', name: 'Desenvolvedor' };

  const nivel = (name: string, levelOrder: number) =>
    ({ id: `n-${name}`, name, levelOrder, positionId: CARGO.id }) as never;

  async function montar(niveis: unknown[]) {
    await TestBed.configureTestingModule({
      imports: [CareerStructureComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        {
          provide: PositionStore,
          useValue: {
            items: signal([CARGO]), loading: signal(false),
            load: () => {}, refresh: () => {},
          },
        },
        {
          provide: PositionLevelStore,
          useValue: {
            levelsOf: () => niveis,
            isLoading: () => false,
            load: () => {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CareerStructureComponent);
    const tela = fixture.componentInstance;
    fixture.detectChanges();

    tela.selectPosition(CARGO as never);
    return tela;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('o primeiro nível de um cargo nasce na ordem 1', async () => {
    const tela = await montar([]);

    tela.openLevelForm();

    expect(tela.levelForm.get('levelOrder')!.value).toBe(1);
  });

  /** **O teste que pega o defeito:** era aqui que saía outro 1. */
  it('com um nível cadastrado, sugere a próxima ordem', async () => {
    const tela = await montar([nivel('Júnior', 1)]);

    tela.openLevelForm();

    expect(tela.levelForm.get('levelOrder')!.value)
      .withContext('Júnior está na 1; Pleno não pode nascer na 1 também')
      .toBe(2);
  });

  it('soma a partir da MAIOR ordem, não da quantidade de níveis', async () => {
    const tela = await montar([nivel('Júnior', 1), nivel('Sênior', 7)]);

    tela.openLevelForm();

    expect(tela.levelForm.get('levelOrder')!.value)
      .withContext('dois níveis, mas a escala já vai até 7')
      .toBe(8);
  });

  it('não se confunde com a ordem em que os níveis chegam', async () => {
    const tela = await montar([nivel('Sênior', 3), nivel('Júnior', 1)]);

    tela.openLevelForm();

    expect(tela.levelForm.get('levelOrder')!.value).toBe(4);
  });

  /** Sugestão, não imposição: dá para encaixar um nível no meio da escala. */
  it('a ordem continua editável', async () => {
    const tela = await montar([nivel('Júnior', 1)]);

    tela.openLevelForm();
    tela.levelForm.get('levelOrder')!.setValue(1);

    expect(tela.levelForm.get('levelOrder')!.value).toBe(1);
    expect(tela.levelForm.get('levelOrder')!.enabled).toBeTrue();
  });
});
