import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { NewsletterRevisaoComponent } from './newsletter-revisao.component';
import { PreviaNewsletterService } from '../../../../infrastructure/services/newsletter/previa-newsletter.service';
import type {
  ClienteDaNewsletter,
  PreviaNewsletter,
} from '../../../../domain/models/newsletter/previa.model';

/**
 * A revisão da newsletter.
 *
 * Os dados destes testes vêm de junho de 2026, medidos na base: 913 clientes,
 * 31 sem e-mail no cadastro do ERP, e 6 ordens de serviço cuja hora não deu
 * para ler.
 *
 * **A tela existe por causa das pendências.** Antes dela, OS com hora escrita
 * como `14h20` eram descartadas em silêncio pelo `TRY_CAST` do SQL — 82 das 350
 * de junho —, e o valor cobrado saía subestimado sem nada indicar.
 */
describe('NewsletterRevisaoComponent', () => {

  const cliente = (codigo: number, nome: string, faturamento: number, email: string | null = 'x@y.com') =>
    ({
      codigoCliente: codigo, nomeDoCliente: nome, emailCliente: email,
      codigoMatriz: null, nomeMatriz: null,
      quantidadeNotasEmitidas: 1, quantidadeDeProdutos: 1, quantidadeDeLitros: 10,
      quantidadeDeVisitas: 1, mediaDiasAtendimento: 2, produtoEmDestaque: 'PRO GRUN',
      faturamentoTotal: faturamento, valorDePecasTrocadas: 0,
      valorTotalDeHoras: 0, valorTotalCobradoHoras: 0, mauUso: false,
    }) as ClienteDaNewsletter;

  const PREVIA: PreviaNewsletter = {
    id: 'p1', mes: 6, ano: 2026, nomeDoMes: 'Junho',
    clientes: [
      cliente(8805, 'EXAL VESUVIUS CAMPO GRANDE RJ', 844.39),
      cliente(8781, 'TEMPERO CERTO - PRESMAK', 4861.07),
      cliente(8632, 'SECTOR FERRAZ DE VASCONCELOS', 612.00, null),
    ],
    pendencias: [
      { numeroOs: 20044, codigoCliente: 8805, nomeDoCliente: 'EXAL VESUVIUS', horaInicio: '1603', horaFim: null },
    ],
  };

  let service: jasmine.SpyObj<PreviaNewsletterService>;
  let tela: NewsletterRevisaoComponent;
  let fixture: ComponentFixture<NewsletterRevisaoComponent>;

  /** O que está na tela agora — sem isto os testes provariam só a classe. */
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const achar = (seletor: string) =>
    (fixture.nativeElement as HTMLElement).querySelectorAll(seletor);

  /**
   * **A janela do Karma é um iframe estreito**, então `max-width: 768px` casa
   * por padrão e a tela nasce em modo celular. Sem dizer a largura, o teste da
   * tabela passaria a conferir os cartões — e passaria verde examinando o
   * elemento errado.
   *
   * A largura tem de valer **antes** de montar: o componente lê o `matchMedia`
   * no construtor.
   */
  function larguraDaJanela(px: number): void {
    const frame = window.frameElement as HTMLElement | null;
    if (!frame) { throw new Error('Sem iframe: este teste depende da largura da janela.'); }

    frame.style.width = `${px}px`;
    frame.getBoundingClientRect();          // força o layout antes do matchMedia
  }

  const NO_COMPUTADOR = 1280;
  const NO_CELULAR = 390;

  afterEach(() => {
    const frame = window.frameElement as HTMLElement | null;
    if (frame) { frame.style.width = ''; }
  });

  async function montar() {
    service = jasmine.createSpyObj<PreviaNewsletterService>('PreviaNewsletterService',
      ['buscar', 'corrigirHora', 'preencherEmails', 'confirmar']);
    service.buscar.and.returnValue(of(PREVIA));

    await TestBed.configureTestingModule({
      imports: [NewsletterRevisaoComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: PreviaNewsletterService, useValue: service },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsletterRevisaoComponent);
    tela = fixture.componentInstance;
    fixture.detectChanges();
    return tela;
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Período ───────────────────────────────────────────────────────────────

  it('começa no mês passado, que é o que se manda', async () => {
    await montar();

    const hoje = new Date();
    const esperado = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
    expect(tela.mes())
      .withContext('a newsletter de junho sai em julho, quando o mês fechou')
      .toBe(esperado);
  });

  /** Mês no futuro devolveria tudo zerado, e zero parece resultado. */
  it('não busca mês no futuro', async () => {
    await montar();
    const proximo = new Date();
    proximo.setMonth(proximo.getMonth() + 1);

    tela.mes.set(proximo.getMonth() + 1);
    tela.ano.set(proximo.getFullYear());

    expect(tela.periodoNoFuturo()).toBeTrue();

    tela.buscar();
    expect(service.buscar).not.toHaveBeenCalled();
  });

  // ── Buscar ────────────────────────────────────────────────────────────────

  it('busca e passa a revisar', async () => {
    await montar();

    tela.buscar();

    expect(service.buscar).toHaveBeenCalledWith(tela.mes(), tela.ano());
    expect(tela.estado()).toBe('revisando');
    expect(tela.clientes().length).toBe(3);
    expect(tela.pendencias().length).toBe(1);
  });

  /**
   * **Mês já confirmado não é falha, é estado.** A API recusa refazer porque a
   * newsletter dispara e-mail; a tela mostra o que ela disse, e não "erro 409".
   */
  it('mês já confirmado vira estado próprio, com a mensagem da API', async () => {
    await montar();
    service.buscar.and.returnValue(throwError(() => ({
      status: 409,
      error: { message: 'Maio de 2026 já foi confirmado em 02/06/2026, com 887 clientes.' },
    })));

    tela.buscar();

    expect(tela.estado()).toBe('jaConfirmado');
    expect(tela.mensagemDeErro()).toContain('887 clientes');
  });

  it('falha de verdade vira erro, e não mês confirmado', async () => {
    await montar();
    service.buscar.and.returnValue(throwError(() => ({ status: 502, error: null })));

    tela.buscar();

    expect(tela.estado()).toBe('erro');
    expect(tela.mensagemDeErro()).toBeTruthy();
  });

  // ── A lista ───────────────────────────────────────────────────────────────

  /** 913 linhas e ninguém confere 913: os maiores são onde o erro custa caro. */
  it('lista do maior faturamento para o menor', async () => {
    await montar();
    tela.buscar();

    expect(tela.clientesVisiveis().map(c => c.codigoCliente)).toEqual([8781, 8805, 8632]);
  });

  it('busca por nome e por código', async () => {
    await montar();
    tela.buscar();

    tela.busca.set('tempero');
    expect(tela.clientesVisiveis().length).toBe(1);

    tela.busca.set('8632');
    expect(tela.clientesVisiveis()[0].nomeDoCliente).toContain('SECTOR');
  });

  it('separa quem está sem e-mail', async () => {
    await montar();
    tela.buscar();

    expect(tela.semEmailCadastrado().map(c => c.codigoCliente)).toEqual([8632]);
  });

  /** 913 clientes no mês, 855 com nota: o número que se manda é o segundo. */
  it('conta separado quem faturou', async () => {
    await montar();
    tela.buscar();

    expect(tela.clientes().length).toBe(3);
    expect(tela.comFaturamento()).toBe(3);
  });

  // ── Correção de hora ──────────────────────────────────────────────────────

  /**
   * A API devolve o cliente recalculado, e a tela troca a linha. Refazer a
   * conta aqui criaria uma segunda fonte para o mesmo número — e é assim que
   * duas contas passam a discordar.
   */
  it('corrigir a hora troca o cliente e some com a pendência', async () => {
    await montar();
    tela.buscar();

    const recalculado = { ...cliente(8805, 'EXAL VESUVIUS CAMPO GRANDE RJ', 844.39), valorTotalCobradoHoras: 450 };
    service.corrigirHora.and.returnValue(of(recalculado as ClienteDaNewsletter));

    tela.corrigirHora(tela.pendencias()[0], '16:03', '17:00');

    expect(service.corrigirHora).toHaveBeenCalledWith('p1', 20044, { horaInicio: '16:03', horaFim: '17:00' });
    expect(tela.pendencias().length).toBe(0);
    expect(tela.clientes().find(c => c.codigoCliente === 8805)!.valorTotalCobradoHoras).toBe(450);
  });

  it('não manda correção pela metade', async () => {
    await montar();
    tela.buscar();

    tela.corrigirHora(tela.pendencias()[0], '16:03', '');

    expect(service.corrigirHora).not.toHaveBeenCalled();
  });

  // ── E-mails ───────────────────────────────────────────────────────────────

  /** 31 clientes sem e-mail; uma requisição por cliente seria desperdício. */
  it('manda os e-mails digitados de uma vez só', async () => {
    await montar();
    tela.buscar();
    service.preencherEmails.and.returnValue(of([
      cliente(8632, 'SECTOR FERRAZ DE VASCONCELOS', 612.00, 'contato@sector.com.br'),
    ]));

    tela.anotarEmail(8632, ' contato@sector.com.br ');
    tela.salvarEmails();

    expect(service.preencherEmails).toHaveBeenCalledWith('p1', [
      { codigoCliente: 8632, email: 'contato@sector.com.br' },
    ]);
    expect(tela.semEmailCadastrado().length)
      .withContext('depois de gravar, ele sai da lista dos sem e-mail')
      .toBe(0);
  });

  it('campo deixado em branco não vira e-mail vazio', async () => {
    await montar();
    tela.buscar();

    tela.anotarEmail(8632, '   ');
    tela.salvarEmails();

    expect(service.preencherEmails).not.toHaveBeenCalled();
    expect(tela.emailsPreenchidos())
      .withContext('o botão conta o que vai ser gravado, não o que foi tocado')
      .toBe(0);
  });

  // ── Confirmar ─────────────────────────────────────────────────────────────

  /**
   * Confirmar com pendência aberta é permitido, por decisão dele: as OS
   * ilegíveis ficam de fora do cálculo, que é o que já acontece hoje — a
   * diferença é que agora aparece.
   */
  it('confirma mesmo com pendência aberta', async () => {
    await montar();
    tela.buscar();
    service.confirmar.and.returnValue(of(void 0));

    expect(tela.pendencias().length).toBe(1);
    tela.confirmar();

    expect(service.confirmar).toHaveBeenCalledWith('p1');
    expect(tela.estado()).toBe('vazio');
  });

  it('erro ao confirmar não limpa a tela', async () => {
    await montar();
    tela.buscar();
    service.confirmar.and.returnValue(throwError(() => ({ error: { message: 'falhou' } })));

    tela.confirmar();

    expect(tela.estado())
      .withContext('perder a revisao por causa de um erro seria o pior desfecho')
      .toBe('revisando');
    expect(tela.clientes().length).toBe(3);
  });

  // ── O que aparece na tela ─────────────────────────────────────────────────
  //
  // Componente não importado, `@if` que nunca abre, `ng-content` faltando: o
  // build fica verde e a tela, vazia. Estes leem o DOM porque é a única coisa
  // que o usuário vê.

  it('sem prévia, explica o que fazer em vez de mostrar tela vazia', async () => {
    await montar();

    expect(achar('pk-empty').length).toBe(1);
    expect(texto()).toContain('Escolha o mês e busque');
  });

  it('desenha o resumo e a tabela depois de buscar', async () => {
    larguraDaJanela(NO_COMPUTADOR);
    await montar();
    tela.buscar();
    fixture.detectChanges();

    expect(achar('pk-kpi').length)
      .withContext('clientes, com faturamento, faturamento total e sem e-mail')
      .toBe(4);
    expect(achar('.lista__tabela tbody tr').length).toBe(3);
    expect(texto()).toContain('Junho de 2026');
  });

  /**
   * **O texto original é a razão da lista de pendências.** `1603` tanto pode
   * ser 16:03 quanto um número digitado errado, e só quem escreveu sabe — some
   * o texto cru e a tela vira um formulário sem pergunta.
   */
  it('mostra a OS ilegível com o texto que está no ERP', async () => {
    await montar();
    tela.buscar();
    fixture.detectChanges();

    const pendencia = achar('.pendencia');
    expect(pendencia.length).toBe(1);

    const conteudo = pendencia[0].textContent ?? '';
    expect(conteudo).toContain('OS 20044');
    expect(conteudo)
      .withContext('o valor cru do campo, e não uma interpretação dele')
      .toContain('1603');
    expect(achar('.pendencia input[type="time"]').length).toBe(2);
  });

  it('marca na lista quem está sem e-mail', async () => {
    larguraDaJanela(NO_COMPUTADOR);
    await montar();
    tela.buscar();
    fixture.detectChanges();

    expect(achar('.lista__tabela tbody tr.sem-email').length).toBe(1);
    expect(texto()).toContain('sem e-mail');
  });

  /**
   * Cartões no celular, decisão dele: oito colunas ali viram rolagem lateral, e
   * quem confere perde de vista de quem é a linha.
   *
   * `@if` e não `display: none` — os cartões trazem campo, e escondido por CSS
   * ele continuaria no DOM para o foco, o tab e o leitor de tela.
   */
  it('no celular troca a tabela por cartões', async () => {
    larguraDaJanela(NO_CELULAR);
    await montar();
    tela.buscar();
    fixture.detectChanges();

    expect(tela.ehCelular())
      .withContext('a largura da janela é o que decide, não uma bandeira do teste')
      .toBeTrue();
    expect(achar('.lista__tabela').length).toBe(0);
    expect(achar('.cartao').length).toBe(3);
  });

  it('mês já confirmado mostra a frase da API, não um código de erro', async () => {
    await montar();
    service.buscar.and.returnValue(throwError(() => ({
      status: 409,
      error: { message: 'Maio de 2026 já foi confirmado em 02/06/2026, com 887 clientes.' },
    })));

    tela.buscar();
    fixture.detectChanges();

    expect(texto()).toContain('887 clientes');
    expect(texto()).not.toContain('409');
  });
});
