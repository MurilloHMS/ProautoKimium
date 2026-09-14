import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { TalentBankLinkRequestComponent } from './talent-bank-link-request.component';
import { environment } from '../../../../environments/environment';

import { providersDeTeste } from '../../../../testing/test-setup';

const URL_DO_LINK = `${environment.apiUrl}/talent-bank/public/access-link`;
const FRASE = 'Se este e-mail estiver no nosso banco de talentos, você receberá um link em instantes.';

describe('TalentBankLinkRequestComponent', () => {
  let fixture: ComponentFixture<TalentBankLinkRequestComponent>;
  let component: TalentBankLinkRequestComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TalentBankLinkRequestComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(TalentBankLinkRequestComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    fixture.destroy(); // para o relógio da contagem
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  async function pedirLinkPara(email: string): Promise<void> {
    component.trocarEmail();
    component.email.set(email);
    component.enviar();
    const req = http.expectOne(URL_DO_LINK);
    expect(req.request.body).toEqual({ email: email.trim().toLowerCase() });
    req.flush('Resposta da API', { status: 202, statusText: 'Accepted' });
    await fixture.whenStable();
  }

  it('mostra a frase fixa da tela, e não o corpo que a API mandou', async () => {
    // A frase é a única coisa que a pessoa vê, e ela não pode depender da
    // resposta: no dia em que alguém "melhorar" a API para dizer "não
    // encontramos", a tela repetiria o oráculo sem ninguém ter mexido nela.
    await pedirLinkPara('mariana@email.com');

    const enviado = fixture.nativeElement.querySelector('[data-testid="link-enviado"]')?.textContent ?? '';
    expect(enviado).toContain(FRASE);
    expect(texto()).not.toContain('Resposta da API');
  });

  it('não chama a API com e-mail inválido', async () => {
    component.email.set('mariana@');
    component.enviar();
    http.expectNone(URL_DO_LINK);
  });

  it('segura o segundo pedido por 60 segundos, e mostra a contagem', async () => {
    await pedirLinkPara('mariana@email.com');

    expect(component.segundosParaReenviar()).toBe(60);
    expect(texto()).toContain('Você pode pedir outro em 1:00');

    component.enviar();
    http.expectNone(URL_DO_LINK);
  });

  it('falha de rede não finge que mandou', async () => {
    component.email.set('mariana@email.com');
    component.enviar();
    http.expectOne(URL_DO_LINK).flush('', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(component.estado()).toBe('pedir');
    expect(texto()).toContain('Não conseguimos enviar agora');
  });
});
