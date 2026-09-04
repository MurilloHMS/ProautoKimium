import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { PerfilComponent } from './perfil.component';
import { VcardService } from '../../../infrastructure/services/profile/vcard/vcard.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { MyProfileResponseDto } from '../../../domain/models/profile.model';

/**
 * A tela de perfil quando ela **não** abre.
 *
 * O caminho feliz não é o que quebra aqui. O que quebrava era o erro: a tela
 * tinha `@if (loading)` e `@else if (data)` e mais nada, então uma falha
 * deixava a página **em branco** com um toast que some em três segundos. Quem
 * chegasse depois disso via uma página vazia e nenhuma explicação.
 *
 * E o erro mais comum tem saída conhecida — a conta de acesso que ninguém
 * vinculou ao cadastro de funcionário. Dizer isso na tela é a diferença entre
 * a pessoa procurar o RH e a pessoa achar que o sistema quebrou.
 */
describe('PerfilComponent · quando não abre', () => {
  let fixture: ComponentFixture<PerfilComponent>;
  let component: PerfilComponent;
  let vcard: jasmine.SpyObj<VcardService>;
  /** MessageService de verdade: o `p-toast` do template assina o observable dele. */
  let toast: MessageService;

  const RECADO_DA_API =
    'Sua conta de acesso ainda não está vinculada ao seu cadastro de funcionário. '
    + 'Peça ao RH para vincular o seu login ao seu cadastro.';

  const erro = (status: number, message?: string) =>
    throwError(() => ({ status, error: message ? { message } : null }));

  beforeEach(async () => {
    vcard = jasmine.createSpyObj<VcardService>('VcardService', [
      'getMyProfile', 'createMyProfile', 'updateMyProfile',
      'downloadVCard', 'uploadMyProfileImage',
    ]);
    toast = new MessageService();
    spyOn(toast, 'add');

    await TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        // O `PermissionStore` da seção "Acesso" busca o mapa por HTTP.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VcardService, useValue: vcard },
        // Não é mais `{}`: a seção "Conta" lê estes três na construção do
        // componente, e um stub vazio quebra antes de qualquer expectativa.
        {
          provide: AuthService,
          useValue: {
            getUsername: () => 'murillo',
            getUserRoles: () => ['DEVELOPER'],
            getExpirationDate: () => new Date(Date.now() + 90 * 60_000),
            logoutRemoto: () => of(void 0),
          },
        },
        { provide: MessageService, useValue: toast },
      ],
    })
      // O componente declara `providers: [MessageService]`, e provider de
      // componente ganha do provider do TestBed. Sem trocar aqui, o espião
      // nunca é o que a tela usa — e o teste do toast passaria a afirmar nada.
      .overrideComponent(PerfilComponent, {
        set: { providers: [{ provide: MessageService, useValue: toast }] },
      })
      .compileComponents();
  });

  const montar = () => {
    fixture = TestBed.createComponent(PerfilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture;
  };

  const texto = () => fixture.nativeElement.textContent as string;

  // ─── Conta sem vínculo ────────────────────────────────────────────────────

  /**
   * **O teste que dá nome ao arquivo.**
   *
   * A frase vem da API, e não está duplicada no front: é lá que se sabe o que
   * houve e para quem pedir. Se o front escrevesse a própria, as duas
   * divergiriam no dia em que alguém melhorasse uma delas.
   */
  it('sem funcionário vinculado, a mensagem da API aparece NA TELA', () => {
    vcard.getMyProfile.and.returnValue(erro(404, RECADO_DA_API));

    montar();

    expect(component.notLinked).toBeTrue();
    expect(texto()).toContain('Sua conta ainda não está vinculada');
    expect(texto()).toContain('Peça ao RH');
  });

  /**
   * **Sem toast neste caso, de propósito.**
   *
   * Um aviso que some em três segundos é o contrário do que alguém travado
   * precisa. A mensagem fica na tela até a pessoa resolver.
   */
  it('a conta sem vínculo não vira toast', () => {
    vcard.getMyProfile.and.returnValue(erro(404, RECADO_DA_API));

    montar();

    expect(toast.add).not.toHaveBeenCalled();
  });

  /**
   * Repetir a requisição não vincula nada. Oferecer um botão que não resolve é
   * pior que não oferecer: gasta o tempo da pessoa e ensina que o botão mente.
   */
  it('não oferece "tentar de novo" para quem não tem vínculo', () => {
    vcard.getMyProfile.and.returnValue(erro(404, RECADO_DA_API));

    montar();

    expect(texto()).not.toContain('Tentar de novo');
  });

  // ─── Qualquer outra falha ─────────────────────────────────────────────────

  /**
   * Um 500 é outra história: pode ter sido a rede, e tentar de novo resolve.
   * Aí o botão aparece — e o toast também, porque não há saída a explicar.
   */
  it('falha genérica mostra o botão de tentar de novo, e avisa', () => {
    vcard.getMyProfile.and.returnValue(erro(500));

    montar();

    expect(component.notLinked).toBeFalse();
    expect(texto()).toContain('Tentar de novo');
    expect(toast.add).toHaveBeenCalled();
  });

  /** Sem mensagem da API, uma frase própria — nunca a tela vazia de antes. */
  it('sem mensagem da API, ainda diz alguma coisa', () => {
    vcard.getMyProfile.and.returnValue(erro(500));

    montar();

    expect(component.errorMessage).toBeTruthy();
    expect(texto()).toContain('Não deu para abrir seu perfil');
  });

  // ─── O caminho feliz continua de pé ───────────────────────────────────────

  it('com vínculo, a tela abre normalmente', () => {
    const resposta: MyProfileResponseDto = {
      profile: null,
      employeeName: 'Ricardo Souza',
      employeeEmail: 'ricardo@proautokimium.com.br',
      employeeCargo: null,
      employeeEmpresa: 'Proauto Kimium',
      canCreateProfile: true,
    } as MyProfileResponseDto;
    vcard.getMyProfile.and.returnValue(of(resposta));

    montar();

    expect(component.notLinked).toBeFalse();
    expect(texto()).toContain('Ricardo Souza');
  });
});
