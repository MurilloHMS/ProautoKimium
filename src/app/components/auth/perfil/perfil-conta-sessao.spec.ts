import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { PerfilComponent } from './perfil.component';
import { VcardService } from '../../../infrastructure/services/profile/vcard/vcard.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { MyProfileResponseDto } from '../../../domain/models/profile.model';

/**
 * **A seção "Conta e sessão" do Perfil.**
 *
 * O `/perfil` mostrava o nome, o cargo e o cartão digital, e mais nada — nem o
 * login, nem os papéis, nem quando a sessão vence. Tudo isso o cliente **já
 * sabia**: sai do token que viaja em toda requisição. A tela só não mostrava.
 *
 * Nenhum destes testes vai à rede por dado novo. Se algum precisar, a seção
 * saiu do desenho.
 */
describe('PerfilComponent · conta e sessão', () => {

  let fixture: ComponentFixture<PerfilComponent>;
  let perfil: PerfilComponent;

  const PERFIL: MyProfileResponseDto = {
    profile: null,
    employeeName: 'Murillo Santos',
    employeeEmail: 'ti@proautokimium.com.br',
    employeeCargo: 'T.I.',
    employeeEmpresa: 'Proauto Kimium',
    canCreateProfile: false,
  };

  /** Daqui a 1h30 — dentro das 2h de vida do access token. */
  const EXPIRA_EM = () => new Date(Date.now() + 90 * 60_000);

  async function montar(auth: Partial<AuthService> = {}): Promise<void> {
    const vcard = jasmine.createSpyObj<VcardService>('VcardService', [
      'getMyProfile', 'createMyProfile', 'updateMyProfile',
      'downloadVCard', 'uploadMyProfileImage',
    ]);
    vcard.getMyProfile.and.returnValue(of(PERFIL));

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: VcardService, useValue: vcard },
        {
          provide: AuthService,
          useValue: {
            getUsername: () => 'murillo',
            getUserRoles: () => ['DEVELOPER', 'ADMIN'],
            getExpirationDate: EXPIRA_EM,
            logoutRemoto: () => of(void 0),
            ...auth,
          },
        },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilComponent);
    perfil = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => TestBed.resetTestingModule());

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('mostra o login e os papéis, que antes não apareciam em lugar nenhum', async () => {
    await montar();

    expect(texto()).toContain('murillo');
    expect(texto()).toContain('DEVELOPER');
    expect(texto()).toContain('ADMIN');
  });

  it('diz quanto falta para a sessão vencer', async () => {
    await montar();

    expect(perfil.sessionLabel()).toBe('1h 30min');
  });

  it('sessão vencida não vira número negativo', async () => {
    await montar({ getExpirationDate: () => new Date(Date.now() - 60_000) });

    expect(perfil.sessionLabel()).toBe('expirada');
    expect(perfil.sessionFraction())
      .withContext('a barra não pode ter comprimento negativo')
      .toBe(0);
  });

  it('sem data de expiração no token, não inventa uma', async () => {
    await montar({ getExpirationDate: () => null });

    expect(perfil.minutosRestantes()).toBeNull();
    expect(perfil.sessionLabel()).toBe('desconhecida');
  });

  /**
   * O cartão digital é gated por `canCreateProfile`; a conta não. Quem não
   * pode criar cartão ainda tem login, papéis e sessão.
   */
  it('a seção aparece mesmo para quem não pode criar cartão digital', async () => {
    await montar();

    expect(perfil.canCreate).withContext('este perfil não pode criar cartão').toBeFalse();
    expect(texto()).toContain('murillo');
  });
});
