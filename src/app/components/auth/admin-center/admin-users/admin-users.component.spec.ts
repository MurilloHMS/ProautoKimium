import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { AdminUsersComponent } from './admin-users.component';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { UserResponseDTO } from '../../../../domain/models/user.model';
import { ScreenRow, TemplateSummary, UserGrid } from '../../../../domain/models/permission-admin.model';
import {
  NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura,
} from '../../../../../testing/test-setup';

/**
 * A aba Usuários da administração: dados da conta e acesso, numa tela só.
 *
 * O que se protege aqui é o que não dá erro quando quebra: o e-mail recusado
 * sumir calado, a conta de cliente ganhar uma grade que não vale nada, e a folha
 * do celular abrir vazia ou rolando para o lado.
 */
describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let component: AdminUsersComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let api: jasmine.SpyObj<PermissionAdminService>;
  const el = () => fixture.nativeElement as HTMLElement;

  const conta = (parcial: Partial<UserResponseDTO>): UserResponseDTO => ({
    id: 'u-x', login: 'x', email: 'x@kimium.com', roles: ['USER'], codParceiro: null, employeeName: null,
    active: true, developer: false, client: false, templates: [], ...parcial,
  });

  const CONTAS: UserResponseDTO[] = [
    conta({ id: 'u-weslley', login: 'weslley', email: 'weslley@kimium.com', employeeName: 'Weslley Andrade',
      codParceiro: '1042', templates: ['ALMOXARIFADO', 'Base'] }),
    conta({ id: 'u-ricardo', login: 'ricardo', email: 'ricardo@kimium.com', employeeName: 'Ricardo Lima' }),
    conta({ id: 'u-cliente', login: 'mercado.sol', email: 'compras@sol.com', client: true, roles: ['CLIENTE'] }),
    conta({ id: 'u-dev', login: 'murillo', email: 'ti@kimium.com', developer: true, roles: ['DEVELOPER'] }),
  ];

  const TELAS: ScreenRow[] = [
    { code: 'stock/products', label: 'Produtos', module: 'Estoque', sortOrder: 10,
      actions: ['ALTERAR', 'EXCLUIR', 'INCLUIR'] },
  ];

  const MODELOS: TemplateSummary[] = [
    { id: 't-almox', name: 'ALMOXARIFADO', description: null, active: true, allowedCells: 3, appliedToUsers: 1 },
  ];

  const ACESSO: UserGrid = {
    id: 'u-weslley', name: 'Weslley Andrade', login: 'weslley', developer: false,
    cells: { 'stock/products': ['ALTERAR', 'INCLUIR'] },
    appliedCells: { 'stock/products': ['ALTERAR', 'EXCLUIR', 'INCLUIR'] },
    appliedTemplates: [{ id: 't-almox', name: 'ALMOXARIFADO', appliedAt: '2026-10-01T10:00:00', appliedBy: 'murillo', mode: 'SOMAR' }],
  };

  async function montar(largura: number, loginDaUrl: string | null = null): Promise<void> {
    larguraDaJanela(largura);
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'getUsers', 'updateUser', 'linkEmployee', 'unlinkEmployee', 'blockUser', 'unblockUser',
      'resetPasswordByAdmin', 'registerUser',
    ]);
    auth.getUsers.and.returnValue(of(CONTAS));
    api = jasmine.createSpyObj<PermissionAdminService>('PermissionAdminService', [
      'screens', 'templates', 'userGrid', 'saveUserGrid', 'apply', 'copyFrom', 'undoApply',
    ]);
    api.screens.and.returnValue(of(TELAS));
    api.templates.and.returnValue(of(MODELOS));
    api.userGrid.and.returnValue(of(ACESSO));

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: providersDeTeste([
        MessageService,
        { provide: AuthService, useValue: auth },
        { provide: PermissionAdminService, useValue: api },
        // Quem abre esta tela tem tudo: o que se testa aqui não é a porta.
        { provide: PermissionStore, useValue: { can: () => true, canOpen: () => true } },
        { provide: EmployeeStore, useValue: { items: signal([]), load: () => {} } },
      ]),
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('initialLogin', loginDaUrl);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    component?.sheetOpen.set(false);
    fixture?.detectChanges();
    restaurarLargura();
  });

  describe('no computador', () => {

    it('abre a conta que veio no link, com dados e acesso lado a lado', async () => {
      await montar(NO_COMPUTADOR, 'ricardo');

      expect(component.selected()?.login).toBe('ricardo');
      expect(api.userGrid).toHaveBeenCalledWith('u-ricardo');
      expect(el().querySelector('#secDados')).not.toBeNull();
      expect(el().querySelector('#secAcesso')).not.toBeNull();
    });

    /**
     * **As roles não aparecem.** Desde a V86 elas não decidem o que a pessoa
     * vê; mostrar "Almoxarifado" como role ao lado do modelo ALMOXARIFADO
     * convidaria a mexer na coisa errada.
     */
    it('o acesso mostra os modelos aplicados, e não as roles', async () => {
      await montar(NO_COMPUTADOR, 'weslley');

      const acesso = el().querySelector('.au__section--access')!.textContent!;
      expect(acesso).toContain('ALMOXARIFADO');
      expect(acesso).not.toContain('USER');
      expect(el().querySelector('app-permission-grid')).not.toBeNull();
    });

    /** Cliente não tem grade: o acesso dele vem do cadastro do cliente. */
    it('conta de cliente não carrega grade e diz de onde vem o acesso', async () => {
      await montar(NO_COMPUTADOR, 'mercado.sol');

      expect(api.userGrid).not.toHaveBeenCalled();
      expect(el().querySelector('app-permission-grid')).toBeNull();
      expect(el().querySelector('.au__note')!.textContent).toContain('portal do cliente');
    });

    it('conta de desenvolvedor não mostra grade para editar', async () => {
      await montar(NO_COMPUTADOR, 'murillo');

      expect(el().querySelector('app-permission-grid')).toBeNull();
      expect(el().querySelector('.au__note')!.textContent).toContain('desenvolvedor');
      expect(el().querySelector('#secDados')!.closest('section')!.textContent)
        .withContext('a saída de emergência não se bloqueia').not.toContain('Bloquear');
    });

    it('salvar o e-mail manda só o e-mail, com a conta certa', async () => {
      await montar(NO_COMPUTADOR, 'ricardo');
      auth.updateUser.and.returnValue(of(void 0));

      component.emailDraft.set(' ricardo.lima@kimium.com ');
      component.saveEmail();

      expect(auth.updateUser).toHaveBeenCalledWith('ricardo', { email: 'ricardo.lima@kimium.com' });
      expect(component.selected()?.email).toBe('ricardo.lima@kimium.com');
    });

    /**
     * **O 409 não pode sumir calado.** A frase da API vai para baixo do campo,
     * onde a pessoa está olhando, e o e-mail da lista continua o antigo.
     */
    it('e-mail de outra conta: a frase da API aparece no campo e nada muda', async () => {
      await montar(NO_COMPUTADOR, 'ricardo');
      auth.updateUser.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 409, error: { message: 'Este e-mail já é usado por outra conta.' },
      })));

      component.emailDraft.set('weslley@kimium.com');
      component.saveEmail();
      fixture.detectChanges();

      expect(component.emailError()).toBe('Este e-mail já é usado por outra conta.');
      expect(el().textContent).toContain('Este e-mail já é usado por outra conta.');
      expect(component.selected()?.email).toBe('ricardo@kimium.com');
    });

    it('e-mail sem formato nem chega à API', async () => {
      await montar(NO_COMPUTADOR, 'ricardo');

      component.emailDraft.set('ricardo-sem-arroba');
      component.saveEmail();

      expect(auth.updateUser).not.toHaveBeenCalled();
      expect(component.emailError()).toBe('E-mail inválido.');
    });
  });

  describe('no celular', () => {

    it('a lista vira cartões e nada abre sozinho', async () => {
      await montar(NO_CELULAR);

      expect(el().querySelectorAll('.au__item').length).toBe(4);
      expect(component.sheetOpen()).toBeFalse();
      expect(el().querySelector('.au__detail')).withContext('a coluna do computador não existe').toBeNull();
    });

    /**
     * **A folha não abre vazia.** O miolo é um `ng-template` servido às duas
     * molduras; com `<ng-content>` repetido, a folha abriria em branco.
     */
    it('tocar numa conta abre a folha com Dados, e Acesso numa aba ao lado', async () => {
      await montar(NO_CELULAR);

      component.select(CONTAS[0]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const folha = document.body.querySelector('.pk-sheet__painel') as HTMLElement;
      expect(folha).not.toBeNull();
      expect(folha.querySelector('#secDados')).not.toBeNull();

      component.sheetTab.set('acesso');
      fixture.detectChanges();
      expect(folha.querySelector('app-permission-grid')).not.toBeNull();
    });

    /** Pedido dele, permanente: nada rola para o lado. */
    it('a 390px nada na folha rola para o lado', async () => {
      await montar(NO_CELULAR);

      component.select(CONTAS[0]);
      component.sheetTab.set('acesso');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      component['grid']()?.toggleOpen('Estoque');
      fixture.detectChanges();

      const caixas = Array.from(document.body.querySelectorAll<HTMLElement>(
        '.pk-sheet__painel, .pk-sheet__miolo, .pgrid, .pgrid__screen, .au__fields'));
      expect(caixas.length).toBeGreaterThan(3);
      for (const caixa of caixas) {
        expect(caixa.scrollWidth).withContext(caixa.className).toBeLessThanOrEqual(caixa.clientWidth + 1);
      }
    });
  });
});
