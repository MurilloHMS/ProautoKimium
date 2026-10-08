import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { AdminCenterComponent } from './admin-center.component';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { PermissionAdminService } from '../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../infrastructure/state/permission.store';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../testing/test-setup';

/**
 * A casca da administração: as duas abas, e a aba na URL — é o que faz o link
 * antigo `settings/permissions/templates` cair em Modelos.
 */
describe('AdminCenterComponent', () => {
  let fixture: ComponentFixture<AdminCenterComponent>;
  let component: AdminCenterComponent;
  const el = () => fixture.nativeElement as HTMLElement;

  async function montar(params: Record<string, string>): Promise<void> {
    larguraDaJanela(NO_COMPUTADOR);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['getUsers']);
    auth.getUsers.and.returnValue(of([]));
    const api = jasmine.createSpyObj<PermissionAdminService>('PermissionAdminService',
      ['screens', 'templates', 'users', 'templateGrid', 'appliedTo']);
    api.screens.and.returnValue(of([]));
    api.templates.and.returnValue(of([]));
    api.users.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AdminCenterComponent],
      providers: providersDeTeste([
        { provide: AuthService, useValue: auth },
        { provide: PermissionAdminService, useValue: api },
        { provide: PermissionStore, useValue: { can: () => true, canOpen: () => true } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ]),
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCenterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => restaurarLargura());

  it('abre em Usuários, e as abas são um controle segmentado', async () => {
    await montar({});

    expect(el().querySelector('app-admin-users')).not.toBeNull();
    const abas = el().querySelectorAll('.pk-tabs [role=tab]');
    expect(abas.length).toBe(2);
    expect(abas[0].getAttribute('aria-selected')).toBe('true');
  });

  it('?aba=modelos abre direto em Modelos', async () => {
    await montar({ aba: 'modelos' });

    expect(el().querySelector('app-admin-templates')).not.toBeNull();
    expect(el().querySelector('app-admin-users')).toBeNull();
  });

  it('trocar de aba escreve na URL, para o voltar do navegador funcionar', async () => {
    await montar({});
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    component.trocarAba('modelos');
    fixture.detectChanges();

    expect(el().querySelector('app-admin-templates')).not.toBeNull();
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { aba: 'modelos', usuario: null },
    }));
  });

  it('o botão da barra muda com a aba', async () => {
    await montar({});
    expect(el().querySelector('.pk-page__bar')!.textContent).toContain('Novo usuário');

    component.trocarAba('modelos');
    fixture.detectChanges();
    expect(el().querySelector('.pk-page__bar')!.textContent).toContain('Novo modelo');
  });
});
