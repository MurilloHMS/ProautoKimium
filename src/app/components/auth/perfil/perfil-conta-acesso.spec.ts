import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { PerfilComponent } from './perfil.component';
import { VcardService } from '../../../infrastructure/services/profile/vcard/vcard.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { PermissionStore } from '../../../infrastructure/state/permission.store';
import { MyProfileResponseDto } from '../../../domain/models/profile.model';

/**
 * **A seção "Conta e acesso" do Perfil.**
 *
 * O `/perfil` mostrava o nome, o cargo e o cartão digital, e mais nada — nem o
 * login, nem os papéis, nem quando a sessão vence, nem em que telas a pessoa
 * entra. Tudo isso o cliente **já sabia**: sai do token e do `PermissionStore`,
 * que o menu carrega de qualquer jeito. A tela só não mostrava.
 *
 * Nenhum destes testes vai à rede por dado novo. Se algum precisar, a seção
 * saiu do desenho.
 */
describe('PerfilComponent · conta e acesso', () => {

  let fixture: ComponentFixture<PerfilComponent>;
  let perfil: PerfilComponent;
  let store: PermissionStore;

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
        provideHttpClient(),
        provideHttpClientTesting(),
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

    store = TestBed.inject(PermissionStore);

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

  // ── A grade de acesso ─────────────────────────────────────────────────────

  /**
   * O mapa vem com o CÓDIGO da tela (`programacao`); quem tem o rótulo humano
   * é o `APP_MENU`. Sem essa tradução a grade lista jargão.
   */
  it('traduz o código da tela para o nome que aparece no menu', async () => {
    await montar();
    store['_permissions'].set({ perfil: ['CONSULTAR'] });
    fixture.detectChanges();

    const linha = perfil.acessos().find(a => a.screen === 'perfil');

    expect(linha).withContext('a tela precisa estar na lista').toBeTruthy();
    expect(linha!.label)
      .withContext('o rótulo sai do APP_MENU, não do código')
      .toContain('Perfil');
  });

  /**
   * **Tela sem rótulo continua na lista.** Sumir seria pior que ficar feia: a
   * pessoa TEM a permissão, e ela não apareceria em lugar nenhum do sistema.
   */
  it('tela que não está no menu aparece pelo código, e não some', async () => {
    await montar();
    store['_permissions'].set({ 'tela/que-nao-existe': ['CONSULTAR'] });
    fixture.detectChanges();

    const linha = perfil.acessos().find(a => a.screen === 'tela/que-nao-existe');

    expect(linha).toBeTruthy();
    expect(linha!.label).toBe('tela/que-nao-existe');
  });

  it('marca cada verbo do catálogo separadamente', async () => {
    await montar();
    store['_permissions'].set({ perfil: ['CONSULTAR', 'ALTERAR'] });
    fixture.detectChanges();

    const linha = perfil.acessos()[0];

    expect(linha.consultar).toBeTrue();
    expect(linha.alterar).toBeTrue();
    expect(linha.incluir).withContext('INCLUIR não foi concedido').toBeFalse();
    expect(linha.excluir).withContext('EXCLUIR não foi concedido').toBeFalse();
  });

  it('mostra três telas e esconde o resto até pedirem', async () => {
    await montar();
    store['_permissions'].set({
      perfil: ['CONSULTAR'], documentos: ['CONSULTAR'],
      programacao: ['CONSULTAR'], produtos: ['CONSULTAR'], estoque: ['CONSULTAR'],
    });
    fixture.detectChanges();

    expect(perfil.acessos().length).toBe(5);
    expect(perfil.acessosVisiveis().length).toBe(3);

    perfil.showAllScreens.set(true);

    expect(perfil.acessosVisiveis().length).toBe(5);
  });

  it('ordena por nome, para a lista não mudar de ordem a cada carregamento', async () => {
    await montar();
    store['_permissions'].set({
      'zzz/ultima': ['CONSULTAR'],
      'aaa/primeira': ['CONSULTAR'],
    });
    fixture.detectChanges();

    const rotulos = perfil.acessos().map(a => a.label);

    expect(rotulos).toEqual([...rotulos].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('sem permissão nenhuma, a grade não quebra', async () => {
    await montar();
    store['_permissions'].set({});
    fixture.detectChanges();

    expect(perfil.acessos()).toEqual([]);
    expect(texto()).toContain('Nenhuma permissão de tela carregada');
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
