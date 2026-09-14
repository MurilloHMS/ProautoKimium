import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { TalentBankEntryComponent } from './talent-bank-entry.component';
import { TalentBankEntryDTO } from '../../../domain/models/talent-bank.model';
import { environment } from '../../../../environments/environment';

import { providersDeTeste } from '../../../../testing/test-setup';

const TOKEN = 'Xq8f2kL9';
const URL_DO_TOKEN = `${environment.apiUrl}/talent-bank/public/${TOKEN}`;
const URL_DAS_AREAS = `${environment.apiUrl}/vaga/areas`;

function cadastro(extra: Partial<TalentBankEntryDTO> = {}): TalentBankEntryDTO {
  return {
    nome: 'Mariana Souza',
    email: 'mariana@email.com',
    telefone: '19981234567',
    urlLinkedin: null,
    areaInteresse: 'Qualidade',
    temCurriculo: true,
    extensaoCurriculo: 'pdf',
    criadoEm: '2026-03-02T09:00:00',
    atualizadoEm: '2026-09-14T10:00:00',
    consentimentoEm: '2026-09-11T09:00:00',
    expiraEm: '2028-09-11T09:00:00',
    candidaturas: [{ vagaTitulo: 'Auxiliar de Expedição', criadoEm: '2026-03-02T09:00:00' }],
    ...extra,
  };
}

describe('TalentBankEntryComponent', () => {
  let fixture: ComponentFixture<TalentBankEntryComponent>;
  let component: TalentBankEntryComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TalentBankEntryComponent],
      providers: providersDeTeste([
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: TOKEN }) } } },
      ]),
    }).compileComponents();

    fixture = TestBed.createComponent(TalentBankEntryComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(URL_DAS_AREAS).flush(['Logística', 'Qualidade']);
  });

  afterEach(() => http.verify());

  async function abrirCom(resposta: TalentBankEntryDTO | { status: number }): Promise<void> {
    const req = http.expectOne((r) => r.method === 'GET' && r.url === URL_DO_TOKEN);
    if ('status' in resposta) {
      req.flush('', { status: resposta.status, statusText: 'x' });
    } else {
      req.flush(resposta);
    }
    await fixture.whenStable();
  }

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('410 vira "este link expirou" e oferece pedir outro', async () => {
    await abrirCom({ status: 410 });

    expect(el('expirado')?.textContent).toContain('Este link expirou');
    expect(fixture.nativeElement.querySelector('a[href="/meu-curriculo"]')).not.toBeNull();
  });

  it('404 tem frase própria, diferente do expirado', async () => {
    await abrirCom({ status: 404 });

    expect(el('invalido')?.textContent).toContain('Link não encontrado');
    expect(el('expirado')).toBeNull();
  });

  it('o botão de apagar só libera com APAGAR digitado', async () => {
    await abrirCom(cadastro());

    (el('pedir-exclusao') as HTMLButtonElement).click();
    await fixture.whenStable();

    const apagar = () => el('apagar') as HTMLButtonElement;
    expect(apagar().disabled).toBeTrue();

    component.textoDeConfirmacao.set('sim');
    await fixture.whenStable();
    expect(apagar().disabled).toBeTrue();

    component.textoDeConfirmacao.set('APAGAR');
    await fixture.whenStable();
    expect(apagar().disabled).toBeFalse();
  });

  it('sem a palavra, apagar não chama a API nem pelo método', async () => {
    await abrirCom(cadastro());
    component.pedirExclusao();
    component.textoDeConfirmacao.set('apaga');

    component.apagar();

    http.expectNone((r) => r.method === 'DELETE');
  });

  it('com a palavra, apaga e mostra a confirmação', async () => {
    await abrirCom(cadastro());
    component.pedirExclusao();
    component.textoDeConfirmacao.set('Apagar ');

    component.apagar();
    http.expectOne((r) => r.method === 'DELETE' && r.url === URL_DO_TOKEN).flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(el('apagado')?.textContent).toContain('Seus dados foram apagados');
  });

  it('a confirmação diz que a candidatura fica, quando existe candidatura', async () => {
    await abrirCom(cadastro());
    component.pedirExclusao();
    await fixture.whenStable();

    expect(el('confirmar-exclusao')?.textContent).toContain('Sua candidatura continua registrada');
  });

  it('a confirmação diz que sai tudo, quando o cadastro foi sem vaga', async () => {
    await abrirCom(cadastro({ candidaturas: [] }));
    component.pedirExclusao();
    await fixture.whenStable();

    expect(el('confirmar-exclusao')?.textContent).toContain('apagados por inteiro');
  });

  it('não manda e-mail no PUT, e manda a renovação só quando marcada', async () => {
    await abrirCom(cadastro());
    component.nome.set('Mariana S. Souza');

    component.salvar();
    const req = http.expectOne((r) => r.method === 'PUT' && r.url === URL_DO_TOKEN);
    const dados = JSON.parse(await ((req.request.body as FormData).get('dados') as Blob).text());

    expect('email' in dados).toBeFalse();
    expect(dados.consentimento).toBeFalse();
    expect(dados.telefone).toBe('19981234567');
    req.flush(cadastro({ nome: 'Mariana S. Souza' }));
  });

  it('quem nunca autorizou vê "autorizo", e não "renovar"', async () => {
    await abrirCom(cadastro({ consentimentoEm: null, expiraEm: null }));

    const pagina = fixture.nativeElement.textContent as string;
    expect(pagina).toContain('Autorizo a Proauto Kimium');
    expect(pagina).not.toContain('Renovar a autorização');
    expect(el('situacao')?.textContent).toContain('Sem autorização para vagas futuras');
  });

  it('área escrita à mão num cadastro antigo aparece como "Outra" com o texto', async () => {
    await abrirCom(cadastro({ areaInteresse: 'Manutenção' }));

    expect(component.area()).toBe(component.AREA_OUTRA);
    expect(component.areaOutra()).toBe('Manutenção');
  });
});
