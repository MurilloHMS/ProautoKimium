import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { NewsletterComponent } from './newsletter.component';
import { NewsletterService } from '../../../../infrastructure/services/newsletter/newsletter.service';
import { descreverStatus, type ResumoDoMes } from '../../../../domain/models/newsletter/resumo-do-mes.model';
import type { Newsletter } from '../../../../domain/models/newsletter.model';

/**
 * O envio, um mês por vez.
 *
 * Era uma lista de 913 linhas com doze colunas, e a pergunta que se faz da
 * newsletter — **"a de junho já saiu?"** — só se respondia lendo linha por
 * linha. O mês, que é a unidade da decisão de quem envia, não aparecia.
 */
describe('NewsletterComponent', () => {

  const JUNHO: ResumoDoMes = {
    mes: 6, ano: 2026, nomeDoMes: 'Junho', total: 905,
    porStatus: { SCHEDULED: 870, PENDING: 31, RETRYING: 4 },
    confirmadoEm: '2026-07-08T09:30:00',
  };

  const MAIO: ResumoDoMes = {
    mes: 5, ano: 2026, nomeDoMes: 'Maio', total: 887,
    porStatus: { SENT: 881, ERROR: 6 },
    confirmadoEm: '2026-06-02T09:30:00',
  };

  /** Mês antigo: veio por planilha, e por isso não tem prévia. */
  const ABRIL: ResumoDoMes = {
    mes: 4, ano: 2026, nomeDoMes: 'Abril', total: 869,
    porStatus: { SENT: 869 },
    confirmadoEm: null,
  };

  const LINHAS = [
    {
      codigoCliente: '8781', nomeDoCliente: 'TEMPERO CERTO - PRESMAK',
      email: 'contato@presmak.com.br', quantidadeNotasEmitidas: 7,
      faturamentoTotal: 4861.07, status: 'PENDING',
    },
  ] as Newsletter[];

  let service: jasmine.SpyObj<NewsletterService>;
  let tela: NewsletterComponent;
  let fixture: ComponentFixture<NewsletterComponent>;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const achar = (seletor: string) => (fixture.nativeElement as HTMLElement).querySelectorAll(seletor);

  async function montar(meses: ResumoDoMes[] = [JUNHO, MAIO, ABRIL]) {
    service = jasmine.createSpyObj<NewsletterService>('NewsletterService',
      ['resumoPorMes', 'doMes', 'sendPendingNewsletters', 'createNewsletterWithOneFile']);
    service.resumoPorMes.and.returnValue(of(meses));
    service.doMes.and.returnValue(of(LINHAS));

    await TestBed.configureTestingModule({
      imports: [NewsletterComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        // O `p-fileUpload` do PrimeNG injeta HttpClient por conta própria,
        // mesmo com `customUpload`: sem isto o teste da planilha morre no NG0201.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NewsletterService, useValue: service },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewsletterComponent);
    tela = fixture.componentInstance;
    fixture.detectChanges();
    return tela;
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Os meses ──────────────────────────────────────────────────────────────

  it('abre mostrando um cartão por mês', async () => {
    await montar();

    expect(achar('.mes').length).toBe(3);
    expect(texto()).toContain('Junho de 2026');
    expect(texto()).toContain('Maio de 2026');
  });

  /** É a resposta que a lista de 913 linhas não dava. */
  it('diz quando o mês foi confirmado e com quantos', async () => {
    await montar();

    expect(texto()).toContain('905 clientes');
    expect(texto()).toContain('08/07/2026');
  });

  /** Mês antigo não tem prévia, e inventar uma data seria pior que não ter. */
  it('mês vindo de planilha diz isso, em vez de uma data inventada', async () => {
    await montar([ABRIL]);

    expect(texto()).toContain('veio por planilha');
    expect(texto()).not.toContain('Confirmada em');
  });

  // ── A barra e os chips ────────────────────────────────────────────────────

  /**
   * **Ordem fixa de ciclo de vida, e não a ordem que o mapa devolveu.**
   *
   * A barra de um mês só serve se puder ser comparada com a do mês passado — e
   * para isso as cores precisam ficar sempre no mesmo lugar. Na ordem das
   * chaves do objeto, elas trocariam de posição a cada mês.
   */
  it('desenha a barra na ordem do ciclo de vida', async () => {
    await montar([JUNHO]);

    expect(tela.fatias(JUNHO).map(f => f.status))
      .toEqual(['PENDING', 'SCHEDULED', 'RETRYING']);
    expect(achar('.barra__fatia').length).toBe(3);
  });

  it('não desenha fatia de status que não existe no mês', async () => {
    await montar([ABRIL]);

    expect(tela.fatias(ABRIL).map(f => f.status)).toEqual(['SENT']);
    expect(achar('.barra__fatia').length).toBe(1);
  });

  /**
   * **Cada status tem um papel de cor, e nenhum papel se repete entre status
   * que aparecem juntos.**
   *
   * Repetir papel não dá erro em lugar nenhum: o mapa aceita, a tela desenha —
   * só desenha igual ao vizinho, e quem lê a fila erra por meses sem saber.
   */
  it('cada status tem ícone próprio, que é o que sobrevive à escala de cinza', async () => {
    await montar();

    const status = ['PENDING', 'SCHEDULED', 'RETRYING', 'SENT', 'ERROR', 'FAILED', 'CANCELED'];
    const icones = status.map(s => descreverStatus(s).icone);

    expect(new Set(icones).size)
      .withContext('ERROR e FAILED dividem o papel danger — o ícone é o que os separa')
      .toBe(status.length);
  });

  it('status desconhecido aparece em cinza, em vez de sumir', async () => {
    const descrito = descreverStatus('ALGO_NOVO');

    expect(descrito.papel).toBe('neutral');
    expect(descrito.label).toBe('ALGO_NOVO');
  });

  // ── Abrir o mês ───────────────────────────────────────────────────────────

  /** 913 por mês: trazer o histórico inteiro é o que a tela antiga fazia. */
  it('só busca as linhas do mês que foi aberto', async () => {
    await montar();

    expect(service.doMes).not.toHaveBeenCalled();

    tela.alternar(JUNHO);
    fixture.detectChanges();

    expect(service.doMes).toHaveBeenCalledOnceWith(6, 2026);
    expect(achar('.lista__tabela tbody tr').length).toBe(1);
    expect(texto()).toContain('TEMPERO CERTO');
  });

  it('clicar de novo fecha e larga as linhas', async () => {
    await montar();

    tela.alternar(JUNHO);
    tela.alternar(JUNHO);
    fixture.detectChanges();

    expect(tela.mesAberto()).toBeNull();
    expect(tela.linhas()).toEqual([]);
    expect(achar('.lista__tabela').length).toBe(0);
  });

  // ── Enviar ────────────────────────────────────────────────────────────────

  /** O botão só existe onde há o que enviar. */
  it('mostra o botão de enviar apenas no mês com pendentes', async () => {
    await montar();

    expect(achar('.mes__enviar').length)
      .withContext('junho tem 31 pendentes; maio e abril não têm nenhum')
      .toBe(1);
  });

  it('dispara e recarrega a fila', async () => {
    await montar();
    service.sendPendingNewsletters.and.returnValue(of('31 e-mails na fila'));

    tela.enviarPendentes();

    expect(service.sendPendingNewsletters).toHaveBeenCalled();
    expect(service.resumoPorMes)
      .withContext('depois do disparo os números mudaram; a tela tem de reler')
      .toHaveBeenCalledTimes(2);
  });

  it('falha no disparo não trava o botão', async () => {
    await montar();
    service.sendPendingNewsletters.and.returnValue(throwError(() => ({ error: 'sem SMTP' })));

    tela.enviarPendentes();

    expect(tela.enviando())
      .withContext('travado, a pessoa não consegue tentar de novo')
      .toBeFalse();
  });

  // ── A planilha ────────────────────────────────────────────────────────────

  /**
   * O upload perdeu a função com a aba de revisão, mas fica.
   *
   * A revisão ainda não fechou um mês inteiro em produção; até lá o caminho
   * antigo é a saída de emergência — atrás de um clique, e não na frente.
   */
  it('a planilha começa fechada', async () => {
    await montar();

    expect(tela.planilhaAberta()).toBeFalse();
    expect(achar('p-fileupload').length).toBe(0);
    expect(texto()).toContain('Subir por planilha');
  });

  it('a planilha abre quando pedida', async () => {
    await montar();

    tela.planilhaAberta.set(true);
    fixture.detectChanges();

    expect(achar('p-fileupload').length).toBe(1);
  });

  // ── Vazio ─────────────────────────────────────────────────────────────────

  it('fila vazia diz o que fazer, em vez de mostrar tela em branco', async () => {
    await montar([]);

    expect(achar('pk-empty').length).toBe(1);
    expect(texto()).toContain('aba de revisão');
  });
});
