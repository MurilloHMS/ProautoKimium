import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../../environments/environment';
import { NO_CELULAR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';
import { BrowserCredentials } from '../../../../infrastructure/webauthn/webauthn-browser';
import { BiometricLoginService } from '../../../../infrastructure/services/auth/biometric-login.service';
import { BiometricDevicesComponent } from './biometric-devices.component';

const URL = `${environment.apiUrl}/auth/webauthn/credentials`;
const aparelho = (id: string, credentialId: string, deviceLabel: string) =>
  ({ id, credentialId, deviceLabel, createdAt: '2026-09-12T10:00:00', lastUsedAt: null });

/** "Entrar sem senha", no Perfil: os aparelhos, o atual marcado, e onde se desliga. */
describe('BiometricDevicesComponent', () => {
  let el: HTMLElement;
  let http: HttpTestingController;

  async function montar(lembrado: string | null, lista: object[]) {
    larguraDaJanela(NO_CELULAR);
    localStorage.clear();
    if (lembrado) localStorage.setItem('pk-digital', JSON.stringify({ credentialId: lembrado, login: 'diego', name: 'Diego' }));
    const browser = jasmine.createSpyObj<BrowserCredentials>('BrowserCredentials', ['available', 'create', 'get']);
    browser.available.and.resolveTo(true);
    TestBed.configureTestingModule({ imports: [BiometricDevicesComponent], providers: providersDeTeste([{ provide: BrowserCredentials, useValue: browser }]) });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BiometricDevicesComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne(URL).flush(lista);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => { restaurarLargura(); localStorage.clear(); });

  const botao = (texto: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.includes(texto));

  it('lista os aparelhos, marca o atual, e não oferece ativar de novo aqui', async () => {
    await montar('Bw', [aparelho('d1', 'Bw', 'Android · Chrome'), aparelho('d2', 'Cx', 'iPhone · Safari')]);

    const itens = el.querySelectorAll('.aparelho');
    expect(itens.length).toBe(2);
    expect(itens[0].textContent).toContain('Android · Chrome');
    expect(itens[0].textContent).toContain('Você está nele');
    expect(itens[1].textContent).not.toContain('Você está nele');
    expect(itens[1].textContent).toContain('Ativado em 12/09/2026 · ainda não usado');
    expect(botao('neste aparelho')).withContext('já está ativa aqui').toBeUndefined();
  });

  it('este aparelho sem a digital: oferece ativar aqui', async () => {
    await montar(null, [aparelho('d2', 'Cx', 'iPhone · Safari')]);
    expect(botao('Ativar a digital neste aparelho')).toBeDefined();
  });

  it('remover o aparelho atual pede confirmação, apaga na API e o aparelho esquece a digital', async () => {
    const fixture = await montar('Bw', [aparelho('d1', 'Bw', 'Android · Chrome')]);

    botao('Remover')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Remover Android · Chrome?');

    Array.from(el.querySelectorAll<HTMLButtonElement>('.bio-botoes button')).find(b => b.textContent!.includes('Remover'))!.click();
    await fixture.whenStable();
    http.expectOne(r => r.method === 'DELETE' && r.url === `${URL}/d1`).flush(null);
    await fixture.whenStable();
    http.expectOne(URL).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(TestBed.inject(BiometricLoginService).remembered()).toBeNull();
    expect(el.textContent).toContain('Nenhum aparelho ainda.');
  });
});
