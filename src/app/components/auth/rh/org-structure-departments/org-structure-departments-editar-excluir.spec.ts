import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { OrgStructureDepartmentsComponent } from './org-structure-departments.component';
import { DepartmentStore } from '../../../../infrastructure/state/org-structure.store';
import { Department } from '../../../../domain/models/hr/org-structure.model';

/**
 * **Editar e excluir departamento.**
 *
 * A tela so cadastrava e listava. Nome digitado errado ficava errado para
 * sempre, e departamento criado por engano ficava na lista para sempre.
 *
 * Excluir **bloqueia quando esta em uso** — decisao dele. Um departamento e
 * apontado por setores e, desde a migracao das FKs, por todo abastecimento; a
 * API recusa com 409 e diz na mensagem quem esta usando. Essa frase e a unica
 * coisa que resolve o problema de quem clicou, entao ela tem que chegar na
 * tela inteira.
 */
describe('OrgStructureDepartmentsComponent · editar e excluir', () => {

  const DEPARTAMENTO: Department = { id: 'dep-1', name: 'Industrial' };

  let store: {
    items: ReturnType<typeof signal<Department[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    load: jasmine.Spy;
    refresh: jasmine.Spy;
    create: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
  };

  let toast: MessageService;

  async function montar() {
    store = {
      items: signal<Department[]>([DEPARTAMENTO]),
      loading: signal(false),
      load: jasmine.createSpy('load'),
      refresh: jasmine.createSpy('refresh'),
      create: jasmine.createSpy('create').and.returnValue(of(DEPARTAMENTO)),
      update: jasmine.createSpy('update').and.returnValue(of(DEPARTAMENTO)),
      delete: jasmine.createSpy('delete').and.returnValue(of(void 0)),
    };

    toast = new MessageService();
    spyOn(toast, 'add');

    await TestBed.configureTestingModule({
      imports: [OrgStructureDepartmentsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        { provide: DepartmentStore, useValue: store },
        { provide: MessageService, useValue: toast },
      ],
    })
      .overrideComponent(OrgStructureDepartmentsComponent, {
        set: { providers: [{ provide: MessageService, useValue: toast }] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(OrgStructureDepartmentsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Editar ────────────────────────────────────────────────────────────────

  it('abrir para editar traz o nome que ja estava gravado', async () => {
    const tela = await montar();

    tela.openEdit(DEPARTAMENTO);

    expect(tela.mode()).toBe('form');
    expect(tela.form.get('name')!.value).toBe('Industrial');
  });

  it('salvar depois de editar ATUALIZA, e nao cria outro', async () => {
    const tela = await montar();

    tela.openEdit(DEPARTAMENTO);
    tela.form.get('name')!.setValue('Industrial e Manutencao');
    tela.save();

    expect(store.update).toHaveBeenCalledWith('dep-1', { name: 'Industrial e Manutencao' });
    expect(store.create)
      .withContext('editar nao pode virar duplicata na lista')
      .not.toHaveBeenCalled();
  });

  it('abrir para novo depois de editar nao herda o item anterior', async () => {
    const tela = await montar();

    tela.openEdit(DEPARTAMENTO);
    tela.closeForm();
    tela.openForm();
    tela.form.get('name')!.setValue('Comercial');
    tela.save();

    expect(store.create).toHaveBeenCalledWith({ name: 'Comercial' });
    expect(store.update)
      .withContext('o id do item editado ficou pendurado no componente')
      .not.toHaveBeenCalled();
  });

  // ── Excluir ───────────────────────────────────────────────────────────────

  it('excluir chama a API com o id', async () => {
    const tela = await montar();

    tela.excluir(DEPARTAMENTO);

    expect(store.delete).toHaveBeenCalledWith('dep-1');
  });

  /**
   * **O teste que importa.** `getErrorMessage` traduzia 409 para "Registro ja
   * existe" — que e a mensagem de nome duplicado, e aqui seria mentira: o
   * problema e que o departamento esta em uso, e quem clicou precisa saber
   * POR QUEM para poder resolver.
   */
  it('quando a API recusa por estar em uso, mostra a frase DELA', async () => {
    const tela = await montar();
    store.delete.and.returnValue(throwError(() => ({
      status: 409,
      error: { message: '3 setores usam este departamento.' },
    })));

    tela.excluir(DEPARTAMENTO);

    expect(toast.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: '3 setores usam este departamento.',
    }));
  });

  it('sem mensagem da API, ainda diz algo util', async () => {
    const tela = await montar();
    store.delete.and.returnValue(throwError(() => ({ status: 409, error: null })));

    tela.excluir(DEPARTAMENTO);

    expect(toast.add).toHaveBeenCalled();
    const chamada = (toast.add as jasmine.Spy).calls.mostRecent().args[0] as { detail?: string };
    expect(chamada.detail).toBeTruthy();
  });
});
