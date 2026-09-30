import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { NO_CELULAR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../testing/test-setup';
import { BrowserCredentials } from '../../../infrastructure/webauthn/webauthn-browser';
import { BiometricLoginService } from '../../../infrastructure/services/auth/biometric-login.service';
import { BiometricInviteComponent } from './biometric-invite.component';

/** O convite: uma vez depois da senha, e só quando faz sentido. */
describe('BiometricInviteComponent', () => {
  let el: HTMLElement;
  let http: HttpTestingController;
  let biometric: BiometricLoginService;
  let available = true;

  async function montar(opts: { convite?: string; lembrado?: object } = {}) {
    larguraDaJanela(NO_CELULAR);
    localStorage.clear();
    sessionStorage.clear();
    if (opts.convite) sessionStorage.setItem('pk-digital-convite', opts.convite);
    if (opts.lembrado) localStorage.setItem('pk-digital', JSON.stringify(opts.lembrado));
    const browser = jasmine.createSpyObj<BrowserCredentials>('BrowserCredentials', ['available', 'create', 'get']);
    browser.available.and.callFake(() => Promise.resolve(available));
    TestBed.configureTestingModule({ imports: [BiometricInviteComponent], providers: providersDeTeste([{ provide: BrowserCredentials, useValue: browser }]) });
    http = TestBed.inject(HttpTestingController);
    biometric = TestBed.inject(BiometricLoginService);
    const fixture = TestBed.createComponent(BiometricInviteComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => (available = true));
  afterEach(() => { restaurarLargura(); localStorage.clear(); sessionStorage.clear(); });

  const aberto = () => el.textContent!.includes('da próxima vez?');

  it('sem ter entrado pela senha agora, não aparece', async () => {
    await montar();
    expect(aberto()).toBeFalse();
  });

  it('entrou pela senha, aparelho com leitor, sem digital: aparece, com as garantias', async () => {
    await montar({ convite: 'diego' });
    expect(aberto()).toBeTrue();
    expect(el.textContent).toContain('Entrar com a digital da próxima vez?');
    expect(el.textContent).toContain('A empresa não recebe nem guarda.');
    expect(el.textContent).toContain('Não perguntar de novo neste celular');
  });

  it('aparelho sem leitor: não aparece', async () => {
    available = false;
    await montar({ convite: 'diego' });
    expect(aberto()).toBeFalse();
  });

  it('"não perguntar de novo" vale na próxima vez', async () => {
    const fixture = await montar({ convite: 'diego' });
    Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Não perguntar'))!.click();
    fixture.detectChanges();

    expect(aberto()).toBeFalse();
    expect(biometric.declined('diego')).toBeTrue();
  });

  it('este aparelho já tem a digital dela, e a API confirma: não aparece', async () => {
    const fixture = await montar({ convite: 'diego', lembrado: { credentialId: 'Bw', login: 'diego', name: 'Diego' } });
    http.expectOne(`${environment.apiUrl}/auth/webauthn/credentials`).flush([{ id: 'd1', credentialId: 'Bw', deviceLabel: 'x', createdAt: '', lastUsedAt: null }]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(aberto()).toBeFalse();
    expect(biometric.remembered()).not.toBeNull();
  });

  it('o RH removeu a digital deste aparelho: esquece a credencial morta e convida de novo', async () => {
    const fixture = await montar({ convite: 'diego', lembrado: { credentialId: 'Bw', login: 'diego', name: 'Diego' } });
    http.expectOne(`${environment.apiUrl}/auth/webauthn/credentials`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(aberto()).toBeTrue();
    expect(biometric.remembered()).toBeNull();
  });

  it('ativou: diz que está pronto', async () => {
    const fixture = await montar({ convite: 'diego' });
    spyOn(biometric, 'enable').and.resolveTo({ id: 'd1', credentialId: 'Bw', deviceLabel: 'x', createdAt: '', lastUsedAt: null });

    Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Ativar a digital'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Pronto!');
  });
});
