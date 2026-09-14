import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { TrabalheConoscoComponent } from './trabalhe-conosco.component';
import { ResponseVagaDTO } from '../../../domain/models/vaga.model';
import { environment } from '../../../../environments/environment';

import { providersDeTeste } from '../../../../testing/test-setup';

const VAGA: ResponseVagaDTO = {
  id: 'b1f4c2d0-7a3e-4c1b-9g00-000000000001',
  titulo: 'Auxiliar de Expedição',
  descricao: 'Separação e conferência de pedidos.',
  requisitos: '',
  beneficios: '',
  area: 'Logística',
  dataAbertura: '2026-09-01T08:00:00',
  dataEncerramento: '2026-10-15T18:00:00',
};

function pdf(): File {
  return new File(['%PDF-1.7'], 'curriculo.pdf', { type: 'application/pdf' });
}

describe('TrabalheConoscoComponent', () => {
  let component: TrabalheConoscoComponent;
  let fixture: ComponentFixture<TrabalheConoscoComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrabalheConoscoComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrabalheConoscoComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responderVagas(vagas: ResponseVagaDTO[]): void {
    http.expectOne(`${environment.apiUrl}/vaga/publicadas`).flush(vagas);
    http.expectOne(`${environment.apiUrl}/vaga/areas`).flush(['Logística', 'Qualidade']);
    fixture.detectChanges();
  }

  /**
   * Com o modal aberto, o `p-select` ajusta estado próprio depois da primeira
   * checagem — o `detectChanges()` síncrono do teste acusa NG0100 por isso. O
   * agendador zoneless, que é o que roda de verdade, não passa por essa
   * checagem dupla.
   */
  async function renderizar(): Promise<void> {
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
  }

  function el(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('mostra a chamada do banco de talentos depois da lista quando há vaga', () => {
    // Componente não importado ou @if trocado: o build passa e a faixa
    // simplesmente não existe.
    responderVagas([VAGA]);

    expect(el('banco-faixa')).not.toBeNull();
    expect(el('banco-vazio')).toBeNull();
  });

  it('sem vaga aberta, a chamada toma o lugar do "volte em breve"', () => {
    responderVagas([]);

    expect(el('banco-vazio')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Volte em breve');
  });

  it('não envia o cadastro sem a autorização marcada', async () => {
    responderVagas([]);
    component.abrirCadastro();
    component.form.patchValue({
      nome: 'Mariana Souza',
      email: 'mariana@email.com',
      telefone: '19981234567',
      consentimento: false,
    });
    component.curriculoFile = pdf();
    await renderizar();

    const botao = el('enviar-cadastro') as HTMLButtonElement;
    expect(botao.disabled).toBeTrue();

    // O botão desligado é enfeite se o método aceitar mesmo assim.
    component.enviarCadastro();
    http.expectNone(`${environment.apiUrl}/talent-bank/public`);
  });

  it('não envia o cadastro sem currículo, e diz por quê', () => {
    responderVagas([]);
    component.abrirCadastro();
    component.form.patchValue({
      nome: 'Mariana Souza',
      email: 'mariana@email.com',
      telefone: '19981234567',
      consentimento: true,
    });

    component.enviarCadastro();

    http.expectNone(`${environment.apiUrl}/talent-bank/public`);
    expect(component.curriculoErro).toBe('Anexe seu currículo em PDF.');
  });

  it('envia o cadastro e confirma com o e-mail digitado, já normalizado', async () => {
    responderVagas([]);
    component.abrirCadastro();
    component.form.patchValue({
      nome: 'Mariana Souza',
      email: 'Mariana@Email.com',
      telefone: '19981234567',
      areaInteresse: component.AREA_OUTRA,
      areaOutra: 'Manutenção',
      consentimento: true,
    });
    component.curriculoFile = pdf();

    component.enviarCadastro();

    const req = http.expectOne(`${environment.apiUrl}/talent-bank/public`);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as FormData;
    expect(body.get('curriculo')).toBeTruthy();

    // A resposta é a mesma para quem é novo e para quem já está no banco.
    req.flush('Recebemos seus dados. Enviamos um e-mail para você com os próximos passos.', {
      status: 202, statusText: 'Accepted',
    });
    await renderizar();

    expect(fixture.nativeElement.textContent).toContain('Recebemos seus dados');
    expect(fixture.nativeElement.textContent).toContain('mariana@email.com');
  });

  it('manda a área "Outra" pelo texto, e não pelo valor interno do combo', async () => {
    responderVagas([]);
    component.abrirCadastro();
    component.form.patchValue({
      nome: 'Mariana Souza',
      email: 'mariana@email.com',
      telefone: '19981234567',
      areaInteresse: component.AREA_OUTRA,
      areaOutra: 'Manutenção',
      consentimento: true,
    });
    component.curriculoFile = pdf();

    component.enviarCadastro();

    const req = http.expectOne(`${environment.apiUrl}/talent-bank/public`);
    const dados = JSON.parse(await (req.request.body.get('dados') as Blob).text());
    expect(dados.areaInteresse).toBe('Manutenção');
    expect(dados.consentimento).toBeTrue();
    req.flush('ok', { status: 202, statusText: 'Accepted' });
  });

  it('413 vira uma frase sobre o tamanho, e não "algo deu errado" genérico', () => {
    responderVagas([]);
    component.abrirCadastro();
    component.form.patchValue({
      nome: 'Mariana Souza',
      email: 'mariana@email.com',
      telefone: '19981234567',
      consentimento: true,
    });
    component.curriculoFile = pdf();

    component.enviarCadastro();
    http.expectOne(`${environment.apiUrl}/talent-bank/public`)
      .flush('', { status: 413, statusText: 'Payload Too Large' });

    expect(component.erroMsg).toBe('O arquivo passa de 10 MB.');
  });

  it('na candidatura a uma vaga, o currículo continua opcional e a autorização vai junto', async () => {
    responderVagas([VAGA]);
    component.abrirVaga(VAGA);
    component.irParaForm();
    component.form.patchValue({
      nome: 'Mariana Souza',
      email: 'mariana@email.com',
      telefone: '19981234567',
      consentimento: false,
    });

    component.enviar();

    const req = http.expectOne(`${environment.apiUrl}/candidatura`);
    expect((req.request.body as FormData).get('curriculo')).toBeNull();
    const dados = JSON.parse(await (req.request.body.get('dados') as Blob).text());
    expect(dados.consentimento).toBeFalse();
    req.flush('ok', { status: 202, statusText: 'Accepted' });
  });
});
