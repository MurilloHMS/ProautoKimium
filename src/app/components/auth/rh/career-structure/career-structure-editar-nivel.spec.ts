import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CareerStructureComponent } from './career-structure.component';
import { PositionStore, PositionLevelStore } from '../../../../infrastructure/state/position.store';
import { PositionLevel } from '../../../../domain/models/hr/career.model';

/**
 * **Alterar o valor base de um nível.**
 *
 * A tela só cadastrava nível. Salário base digitado errado — ou simplesmente
 * desatualizado — não tinha como ser corrigido: a saída era criar outro nível
 * e conviver com o errado na lista.
 *
 * **O detalhe que manda no desenho é a cascata.** Nível percentual resolve o
 * salário sobre o nível imediatamente anterior (`PositionLevelSalaryResolver`
 * na API), então mudar o valor base do Júnior muda o salário calculado de
 * Pleno e Sênior junto. Trocar só a linha editada na tela deixaria as outras
 * mostrando salário velho — numa tela de salário, que é onde menos se pode
 * mostrar número errado.
 */
describe('CareerStructureComponent · editar o nível', () => {

  const CARGO = { id: 'cargo-1', name: 'Desenvolvedor' };

  const JUNIOR: PositionLevel = {
    id: 'nivel-1', name: 'Júnior', levelOrder: 1, positionId: CARGO.id,
    adjustmentType: 'FIXED', fixedAmount: 3000, percentageIncrease: null,
    resolvedSalary: 3000,
  };

  let levelStore: {
    levelsOf: jasmine.Spy;
    isLoading: jasmine.Spy;
    load: jasmine.Spy;
    create: jasmine.Spy;
    update: jasmine.Spy;
  };

  let toast: MessageService;

  async function montar() {
    levelStore = {
      levelsOf: jasmine.createSpy('levelsOf').and.returnValue([JUNIOR]),
      isLoading: jasmine.createSpy('isLoading').and.returnValue(false),
      load: jasmine.createSpy('load'),
      create: jasmine.createSpy('create').and.returnValue(of(JUNIOR)),
      update: jasmine.createSpy('update').and.returnValue(of(JUNIOR)),
    };

    toast = new MessageService();
    spyOn(toast, 'add');

    await TestBed.configureTestingModule({
      imports: [CareerStructureComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: PositionStore,
          useValue: {
            items: signal([CARGO]), loading: signal(false),
            load: () => {}, refresh: () => {},
          },
        },
        { provide: PositionLevelStore, useValue: levelStore },
        { provide: MessageService, useValue: toast },
      ],
    })
      .overrideComponent(CareerStructureComponent, {
        set: { providers: [{ provide: MessageService, useValue: toast }] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(CareerStructureComponent);
    const tela = fixture.componentInstance;
    fixture.detectChanges();

    tela.selectPosition(CARGO as never);
    return tela;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('abrir para editar traz o que já estava gravado', async () => {
    const tela = await montar();

    tela.openEditLevel(JUNIOR);

    expect(tela.mode()).toBe('level');
    expect(tela.levelForm.get('name')!.value).toBe('Júnior');
    expect(tela.levelForm.get('levelOrder')!.value).toBe(1);
    expect(tela.levelForm.get('adjustmentType')!.value).toBe('FIXED');
    expect(tela.levelForm.get('fixedAmount')!.value).toBe(3000);
  });

  it('salvar depois de editar ATUALIZA, e não cria outro nível', async () => {
    const tela = await montar();

    tela.openEditLevel(JUNIOR);
    tela.levelForm.get('fixedAmount')!.setValue(3500);
    tela.saveLevel();

    expect(levelStore.update).toHaveBeenCalledWith('nivel-1', jasmine.objectContaining({
      name: 'Júnior',
      levelOrder: 1,
      positionId: CARGO.id,
      adjustmentType: 'FIXED',
      fixedAmount: 3500,
    }));
    expect(levelStore.create)
      .withContext('corrigir o valor não pode virar um nível duplicado')
      .not.toHaveBeenCalled();
  });

  /** **O teste que pega a cascata.** */
  it('depois de salvar, recarrega os níveis do cargo', async () => {
    const tela = await montar();
    levelStore.load.calls.reset();

    tela.openEditLevel(JUNIOR);
    tela.levelForm.get('fixedAmount')!.setValue(3500);
    tela.saveLevel();

    expect(levelStore.load)
      .withContext('nível percentual resolve sobre o anterior: os de cima mudaram junto')
      .toHaveBeenCalledWith(CARGO.id, true);
  });

  it('percentual guarda o percentual e zera o valor fixo', async () => {
    const tela = await montar();

    tela.openEditLevel(JUNIOR);
    tela.levelForm.patchValue({ adjustmentType: 'PERCENTAGE', percentageIncrease: 15 });
    tela.saveLevel();

    expect(levelStore.update).toHaveBeenCalledWith('nivel-1', jasmine.objectContaining({
      adjustmentType: 'PERCENTAGE',
      percentageIncrease: 15,
      fixedAmount: null,
    }));
  });

  it('abrir para novo depois de editar não herda o nível anterior', async () => {
    const tela = await montar();

    tela.openEditLevel(JUNIOR);
    tela.openLevelForm();
    tela.levelForm.patchValue({ name: 'Pleno', fixedAmount: 5000 });
    tela.saveLevel();

    expect(levelStore.create).toHaveBeenCalled();
    expect(levelStore.update)
      .withContext('o id do nível editado ficou pendurado no componente')
      .not.toHaveBeenCalled();
  });

  it('erro ao salvar mantém o formulário aberto', async () => {
    const tela = await montar();
    levelStore.update.and.returnValue(throwError(() => ({ status: 400, error: null })));

    tela.openEditLevel(JUNIOR);
    tela.saveLevel();

    expect(tela.mode())
      .withContext('fechar apagaria o que a pessoa acabou de digitar')
      .toBe('level');
    expect(toast.add).toHaveBeenCalled();
  });
});
