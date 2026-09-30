import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { providersDeTeste } from '../../../../testing/test-setup';
import { BrowserCredentials } from '../../webauthn/webauthn-browser';
import { AuthService } from '../auth.service';
import { BiometricError, BiometricLoginService } from './biometric-login.service';

const API = `${environment.apiUrl}/auth/webauthn`;
const buf = (...b: number[]) => new Uint8Array(b).buffer;

/**
 * O lado do site das duas cerimônias. O leitor do aparelho é falso (o Karma
 * não tem digital); a API é a do HttpTestingController.
 */
describe('BiometricLoginService', () => {
  let service: BiometricLoginService;
  let http: HttpTestingController;
  let browser: jasmine.SpyObj<BrowserCredentials>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    browser = jasmine.createSpyObj<BrowserCredentials>('BrowserCredentials', ['available', 'create', 'get']);
    browser.available.and.resolveTo(true);
    TestBed.configureTestingModule({ providers: providersDeTeste([{ provide: BrowserCredentials, useValue: browser }]) });
    service = TestBed.inject(BiometricLoginService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  /** Espera o pedido aparecer (as etapas são encadeadas por await). */
  async function request(url: string) {
    for (let i = 0; i < 50; i++) {
      const found = http.match(url);
      if (found.length) return found[0];
      await new Promise(r => setTimeout(r));
    }
    throw new Error('nenhum pedido para ' + url);
  }

  const registrationOptions = {
    challengeId: 'c1', challenge: 'AQID', rpId: 'localhost', rpName: 'KimiumHub', userId: 'dS0x',
    userName: 'diego', userDisplayName: 'Diego Martins', excludeCredentialIds: [], timeoutMs: 300000,
  };

  describe('ativar', () => {
    it('cria no leitor do aparelho, grava na API e lembra quem ativou', async () => {
      browser.create.and.resolveTo({
        rawId: buf(7), response: { clientDataJSON: buf(1), attestationObject: buf(2), getTransports: () => ['internal'] },
      } as unknown as Credential);

      const done = service.enable();
      (await request(`${API}/registration/options`)).flush(registrationOptions);
      const register = await request(`${API}/registration`);
      expect(register.request.body).toEqual({ challengeId: 'c1', clientDataJSON: 'AQ', attestationObject: 'Ag', transports: ['internal'] });
      register.flush({ id: 'd1', credentialId: 'Bw', deviceLabel: 'Android · Chrome', createdAt: '2026-09-30T10:00:00', lastUsedAt: null });
      await done;

      expect(browser.create.calls.mostRecent().args[0].authenticatorSelection?.userVerification).toBe('required');
      expect(service.remembered()).toEqual({ credentialId: 'Bw', login: 'diego', name: 'Diego Martins' });
    });

    it('a pessoa cancelou a digital: nada vai para a API, nada é lembrado', async () => {
      browser.create.and.rejectWith(new DOMException('cancelou', 'NotAllowedError'));

      const done = service.enable();
      (await request(`${API}/registration/options`)).flush(registrationOptions);

      await expectAsync(done).toBeRejectedWith(jasmine.objectContaining({ kind: 'cancelled' }));
      http.expectNone(`${API}/registration`);
      expect(service.remembered()).toBeNull();
    });

    it('o navegador devolveu nada (sem erro): conta como cancelado, e nada vai para a API', async () => {
      browser.create.and.resolveTo(null);

      const done = service.enable();
      (await request(`${API}/registration/options`)).flush(registrationOptions);

      await expectAsync(done).toBeRejectedWith(jasmine.objectContaining({ kind: 'cancelled' }));
      http.expectNone(`${API}/registration`);
    });

    it('o aparelho já tinha a digital desta pessoa: diz isso', async () => {
      browser.create.and.rejectWith(new DOMException('já existe', 'InvalidStateError'));

      const done = service.enable();
      (await request(`${API}/registration/options`)).flush(registrationOptions);

      await expectAsync(done).toBeRejectedWith(jasmine.objectContaining({ kind: 'already' }));
    });
  });

  describe('entrar', () => {
    beforeEach(() => {
      localStorage.setItem('pk-digital', JSON.stringify({ credentialId: 'Bw', login: 'diego', name: 'Diego Martins' }));
    });

    const assertion = {
      rawId: buf(7), response: { clientDataJSON: buf(1), authenticatorData: buf(2), signature: buf(3), userHandle: null },
    } as unknown as Credential;

    it('pede só a credencial lembrada, confere na API e grava a sessão como o login com senha', async () => {
      browser.get.and.resolveTo(assertion);
      const guardar = spyOn(TestBed.inject(AuthService), 'guardarSessao');

      const done = service.signIn();
      (await request(`${API}/authentication/options`)).flush({ challengeId: 'c2', challenge: 'AQID', rpId: 'localhost', timeoutMs: 1 });
      const auth = await request(`${API}/authentication`);
      expect(auth.request.body.credentialId).toBe('Bw');
      auth.flush({ token: 'access', refreshToken: 'refresh' });
      await done;

      const pedido = browser.get.calls.mostRecent().args[0];
      expect(new Uint8Array(pedido.allowCredentials![0].id as ArrayBuffer)).toEqual(new Uint8Array([7]));
      expect(guardar).toHaveBeenCalledOnceWith({ token: 'access', refreshToken: 'refresh' });
    });

    it('a API recusou: a frase da tela, e nenhuma sessão', async () => {
      browser.get.and.resolveTo(assertion);
      const guardar = spyOn(TestBed.inject(AuthService), 'guardarSessao');

      const done = service.signIn();
      (await request(`${API}/authentication/options`)).flush({ challengeId: 'c2', challenge: 'AQID', rpId: 'localhost', timeoutMs: 1 });
      (await request(`${API}/authentication`)).flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });

      await expectAsync(done).toBeRejectedWith(new BiometricError('rejected', 'Não deu para confirmar pela digital. Tente de novo, ou entre com a senha.'));
      expect(guardar).not.toHaveBeenCalled();
    });

    it('conta bloqueada: vale a frase da API', async () => {
      browser.get.and.resolveTo(assertion);

      const done = service.signIn();
      (await request(`${API}/authentication/options`)).flush({ challengeId: 'c2', challenge: 'AQID', rpId: 'localhost', timeoutMs: 1 });
      (await request(`${API}/authentication`)).flush({ message: 'Acesso negado! Verifique com o RH' }, { status: 403, statusText: 'Forbidden' });

      await expectAsync(done).toBeRejectedWith(jasmine.objectContaining({ kind: 'blocked', message: 'Acesso negado! Verifique com o RH' }));
    });
  });

  it('armazenamento bloqueado (janela anônima): sem atalho, sem erro', () => {
    spyOn(localStorage, 'getItem').and.throwError('SecurityError');
    expect(service.remembered()).toBeNull();
    expect(service.declined('diego')).toBeFalse();
  });

  it('o convite é lido uma vez só', () => {
    service.markInvite('diego');
    expect(service.takeInvite()).toBe('diego');
    expect(service.takeInvite()).toBeNull();
  });
});
