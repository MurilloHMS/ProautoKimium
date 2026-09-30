import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { providersDeTeste } from '../../../../testing/test-setup';
import { BrowserCredentials } from '../../../infrastructure/webauthn/webauthn-browser';
import { BiometricError, BiometricLoginService } from '../../../infrastructure/services/auth/biometric-login.service';
import { AuthService } from '../../../infrastructure/services/auth.service';
import { LoginComponent } from './login.component';

/**
 * A tela de login com a digital (mockup aprovado em 2026-09-30): quem ativou
 * neste aparelho vê a digital primeiro; a senha fica a um toque; a recusa abre
 * a senha com o login preenchido.
 */
describe('LoginComponent · digital', () => {
  let el: HTMLElement;
  let biometric: BiometricLoginService;

  async function montar(lembrado: boolean) {
    localStorage.clear();
    sessionStorage.clear();
    if (lembrado) localStorage.setItem('pk-digital', JSON.stringify({ credentialId: 'Bw', login: 'diego', name: 'Diego Martins' }));
    const browser = jasmine.createSpyObj<BrowserCredentials>('BrowserCredentials', ['available', 'create', 'get']);
    browser.available.and.resolveTo(true);
    TestBed.configureTestingModule({ imports: [LoginComponent], providers: providersDeTeste([{ provide: BrowserCredentials, useValue: browser }]) });
    biometric = TestBed.inject(BiometricLoginService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const botao = (texto: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.includes(texto));

  afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('sem digital neste aparelho, a tela é a de sempre', async () => {
    await montar(false);
    expect(el.querySelector('#password')).not.toBeNull();
    expect(botao('Entrar com a digital')).toBeUndefined();
  });

  it('com digital: mostra quem ativou e o botão da digital, e esconde a senha', async () => {
    await montar(true);
    expect(el.textContent).toContain('Diego Martins');
    expect(el.textContent).toContain('diego');
    expect(botao('Entrar com a digital')).toBeDefined();
    expect(el.querySelector('#password')).withContext('a senha fica a um toque').toBeNull();
  });

  it('a digital confirmou: entra', async () => {
    const fixture = await montar(true);
    spyOn(biometric, 'signIn').and.resolveTo();

    botao('Entrar com a digital')!.click();
    await fixture.whenStable();

    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/home']);
  });

  it('a digital recusou: a frase, a senha aberta com o login preenchido, e "tentar de novo"', async () => {
    const fixture = await montar(true);
    spyOn(biometric, 'signIn').and.rejectWith(new BiometricError('rejected', 'Não deu para confirmar pela digital. Tente de novo, ou entre com a senha.'));

    botao('Entrar com a digital')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Não deu para confirmar pela digital');
    expect(el.querySelector<HTMLInputElement>('#username')!.value).toBe('diego');
    expect(el.querySelector('#password')).not.toBeNull();
    expect(botao('Tentar a digital de novo')).toBeDefined();
  });

  it('"Entrar com a senha" abre o formulário sem esquecer a digital', async () => {
    const fixture = await montar(true);
    botao('Entrar com a senha')!.click();
    fixture.detectChanges();

    expect(el.querySelector('#password')).not.toBeNull();
    expect(biometric.remembered()).not.toBeNull();
  });

  it('"Não é você?": o aparelho esquece quem ativou, e o login fica em branco', async () => {
    const fixture = await montar(true);
    botao('Não é você?')!.click();
    fixture.detectChanges();

    expect(biometric.remembered()).toBeNull();
    expect(el.querySelector<HTMLInputElement>('#username')!.value).toBe('');
    expect(el.textContent).not.toContain('Diego Martins');
  });

  it('entrou pela senha: marca o convite da digital para dentro do sistema', async () => {
    const fixture = await montar(false);
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'login').and.returnValue(of({ token: 'x', refreshToken: 'y' }));
    spyOn(auth, 'getUsername').and.returnValue('diego');
    spyOn(auth, 'getUserRoles').and.returnValue(['USER']);

    fixture.componentInstance.form.setValue({ username: 'diego', password: 'x' });
    fixture.componentInstance.login();

    expect(biometric.takeInvite()).toBe('diego');
  });
});
