import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../../../environments/environment';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../../testing/test-setup';
import { EmployeeBiometricDevicesComponent } from './employee-biometric-devices.component';

const URL = `${environment.apiUrl}/employee/e1/webauthn-credentials`;
const aparelho = (id: string, deviceLabel: string) =>
  ({ id, credentialId: id, deviceLabel, createdAt: '2026-09-15T10:00:00', lastUsedAt: null });

/** "Acesso com digital", no cadastro do funcionário: o RH remove um, ou todos. */
describe('EmployeeBiometricDevicesComponent', () => {
  let el: HTMLElement;
  let http: HttpTestingController;

  async function montar(lista: object[]) {
    larguraDaJanela(NO_COMPUTADOR);
    TestBed.configureTestingModule({ imports: [EmployeeBiometricDevicesComponent], providers: providersDeTeste() });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EmployeeBiometricDevicesComponent);
    fixture.componentRef.setInput('employeeId', 'e1');
    fixture.componentRef.setInput('employeeName', 'Diego Martins');
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne(URL).flush(lista);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => { restaurarLargura(); http.verify(); });

  const botao = (texto: string, dentro: ParentNode = el) =>
    Array.from(dentro.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.trim() === texto);

  it('a tabela com os aparelhos, e o aviso de que a pessoa é avisada', async () => {
    await montar([aparelho('d1', 'Android · Chrome'), aparelho('d2', 'Windows · Edge')]);

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('15/09/2026');
    expect(el.textContent).toContain('Diego Martins recebe um aviso no sino');
    expect(botao('Remover todos')).toBeDefined();
  });

  it('sem aparelho: diz isso, e não oferece "remover todos"', async () => {
    await montar([]);
    expect(el.textContent).toContain('Nenhum aparelho com a digital ativada.');
    expect(botao('Remover todos')).toBeUndefined();
  });

  it('"Remover todos" confirma com a contagem e apaga sem id', async () => {
    const fixture = await montar([aparelho('d1', 'Android · Chrome'), aparelho('d2', 'Windows · Edge')]);

    botao('Remover todos')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Remover os 2 aparelhos de Diego Martins?');

    botao('Remover todos', document.body.querySelector('.rh-bio__botoes')!)!.click();
    await fixture.whenStable();
    http.expectOne(r => r.method === 'DELETE' && r.url === URL).flush(null);
    await fixture.whenStable();
    http.expectOne(r => r.method === 'GET' && r.url === URL).flush([]);
    await fixture.whenStable();
  });

  it('"Remover" de uma linha apaga só aquele', async () => {
    const fixture = await montar([aparelho('d1', 'Android · Chrome'), aparelho('d2', 'Windows · Edge')]);

    el.querySelectorAll<HTMLButtonElement>('.rh-bio__remover')[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Remover Windows · Edge de Diego Martins?');

    botao('Remover', document.body.querySelector('.rh-bio__botoes')!)!.click();
    await fixture.whenStable();
    http.expectOne(r => r.method === 'DELETE' && r.url === `${URL}/d2`).flush(null);
    await fixture.whenStable();
    http.expectOne(r => r.method === 'GET' && r.url === URL).flush([]);
    await fixture.whenStable();
  });
});
