import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { AdminScreensComponent } from './admin-screens.component';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { ScreenAccessOverview, ScreenRow } from '../../../../domain/models/permission-admin.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

/**
 * A aba Telas: "a tela checklist, quem tem acesso?". O que se protege é a
 * resposta estar certa — quem, o quê, e de onde vem cada ação.
 */
describe('AdminScreensComponent', () => {
  let fixture: ComponentFixture<AdminScreensComponent>;
  let component: AdminScreensComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = (seletor: string) => el().querySelector(seletor)!.textContent!.replace(/\s+/g, ' ').trim();

  const TELAS: ScreenRow[] = [
    { code: 'vendas/checklist', label: 'Checklist de implantação', module: 'Vendas', sortOrder: 10,
      actions: ['ALTERAR', 'CONSULTAR', 'INCLUIR', 'ENVIAR'] },
    { code: 'rh/reimbursements', label: 'Reembolsos', module: 'Recursos Humanos', sortOrder: 20,
      actions: ['CONSULTAR'] },
  ];

  const VISAO: ScreenAccessOverview = {
    developers: 1,
    screens: [
      { screen: 'vendas/checklist', people: [
        { id: 'u-r', name: 'Ricardo Lima', login: 'ricardo', active: true,
          actions: ['ALTERAR', 'CONSULTAR', 'INCLUIR', 'ENVIAR'], templates: ['VENDEDOR'], addedByHand: [], removedByHand: [] },
        { id: 'u-a', name: 'Ana Souza', login: 'ana', active: true,
          actions: ['ALTERAR', 'CONSULTAR', 'INCLUIR'], templates: ['VENDEDOR'], addedByHand: [], removedByHand: ['ENVIAR'] },
        { id: 'u-c', name: 'Carlos Dias', login: 'carlos', active: false,
          actions: ['CONSULTAR', 'INCLUIR'], templates: [], addedByHand: ['CONSULTAR', 'INCLUIR'], removedByHand: [] },
      ] },
      { screen: 'rh/reimbursements', people: [] },
    ],
  };

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    const api = jasmine.createSpyObj<PermissionAdminService>('PermissionAdminService', ['screens', 'screenAccess']);
    api.screens.and.returnValue(of(TELAS));
    api.screenAccess.and.returnValue(of(VISAO));

    await TestBed.configureTestingModule({
      imports: [AdminScreensComponent],
      providers: providersDeTeste([MessageService, { provide: PermissionAdminService, useValue: api }]),
    }).compileComponents();

    fixture = TestBed.createComponent(AdminScreensComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => restaurarLargura());

  it('a lista diz quantas pessoas acessam cada tela, e "ninguém" quando ninguém', () => {
    const itens = Array.from(el().querySelectorAll('.as__item')).map(i =>
      `${i.querySelector('.as__item-name')!.textContent!.trim()} · ${i.querySelector('.as__item-count')!.textContent!.trim()}`);
    expect(itens).toEqual(['Checklist de implantação · 3 pessoas', 'Reembolsos · ninguém']);
  });

  it('o resumo conta por ação, na ordem de leitura, e o desenvolvedor fica à parte', () => {
    expect(component.selectedCode()).withContext('abre a primeira com gente').toBe('vendas/checklist');
    const caixas = Array.from(el().querySelectorAll('.as__box')).map(c =>
      `${c.querySelector('b')!.textContent!.trim()} ${c.querySelector('span')!.textContent!.trim()}`);
    expect(caixas).toEqual(['3 podem Ver', '3 podem Incluir', '2 podem Alterar', '1 pode Enviar']);
    expect(texto('.as__dev-note')).toContain('A conta de desenvolvedor acessa tudo');
  });

  /** **O que dá sentido à aba:** de onde vem cada acesso, nas duas direções do ajuste. */
  it('cada pessoa diz de onde vem o acesso: modelo, liberado à mão, tirado à mão', () => {
    const linhas = Array.from(el().querySelectorAll('.as__rows .as__row'))
      .map(l => l.textContent!.replace(/\s+/g, ' ').trim());

    expect(linhas[0]).toContain('VENDEDOR');
    expect(linhas[1]).toContain('Enviar tirado à mão');
    expect(linhas[2]).toContain('liberado à mão');
    expect(linhas[2]).toContain('bloqueado');
  });

  it('clicar numa pessoa pede para abrir a conta dela', () => {
    let aberto = '';
    component.openUser.subscribe(login => aberto = login);

    (el().querySelectorAll<HTMLButtonElement>('.as__rows .as__row')[1]).click();

    expect(aberto).toBe('ana');
  });

  it('tela sem ninguém diz isso, em vez de uma tabela vazia', () => {
    component.select('rh/reimbursements');
    fixture.detectChanges();

    expect(el().querySelector('.as__rows')).toBeNull();
    expect(texto('.as__nobody')).toContain('Ninguém acessa esta tela');
  });
});
