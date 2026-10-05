import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { EmployesComponent } from './employes.component';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { Employee } from '../../../../domain/models/employee.model';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * A ficha do funcionário (2026-10-05). A lista leva à ficha; o "Editar dados"
 * da ficha volta para cá com `?editar=<id>` e o formulário já aberto.
 */
describe('EmployesComponent · ficha do funcionário', () => {
  const ANA = { id: 'e1', name: 'Ana Souza', partnerCode: '9001', document: '', email: 'a@t.com', ativo: true,
                managerCode: '', birthday: null as never } as Employee;

  async function montar(query: Record<string, string>) {
    const params = new BehaviorSubject(convertToParamMap(query));
    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: [
        ...providersDeTeste(),
        { provide: EmployeeStore, useValue: { items: signal([ANA]), load: () => {}, refresh: () => {}, loading: signal(false),
                                              options: signal([]), activeOptions: signal([]), nameOf: () => '' } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(EmployesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { tela: fixture.componentInstance, router };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('clicar na pessoa abre a ficha dela', async () => {
    const { tela, router } = await montar({});
    tela.openProfile(ANA);
    expect(router.navigate).toHaveBeenCalledWith(['/rh/employees', 'e1']);
  });

  it('?editar abre o formulário daquela pessoa e limpa o parâmetro', async () => {
    const { tela, router } = await montar({ editar: 'e1' });
    expect(tela.mode()).toBe('form');
    expect(tela.employeToEdit?.id).toBe('e1');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { editar: null } }));
  });

  it('sem ?editar, a tela abre na lista', async () => {
    const { tela } = await montar({});
    expect(tela.mode()).toBe('grid');
  });
});
