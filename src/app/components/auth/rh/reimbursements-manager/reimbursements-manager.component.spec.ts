import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ReimbursementsManagerComponent } from './reimbursements-manager.component';
import { environment } from '../../../../../environments/environment';
import {
  NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura,
} from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/reimbursements`;
const RESUMO = {
  month: '2026-09', sent: { amount: 1694.9, count: 7 }, pending: { amount: 416.5, count: 2 },
  approved: { amount: 92, count: 1 }, paid: { amount: 180, count: 1 }, contestedPending: 1,
};

/**
 * A tela do RH no celular — 70% dos acessos (dito por ele em 2026-09-28).
 *
 * Medido a 390px: a toolbar quebrava em várias linhas (182px) e os totais em
 * 2×2 ocupavam 226px; sobravam 2 cartões visíveis. Em 2026-09-29 os totais
 * saíram das duas larguras (a análise foi para os Indicadores), e a contagem
 * do mês ficou nos chips de status.
 *
 * `detectChanges(false)`: a tela usa campos comuns, e no teste sem zone.js a
 * checagem extra acusaria a mudança feita pela resposta HTTP.
 */
describe('ReimbursementsManagerComponent', () => {
  let fixture: ComponentFixture<ReimbursementsManagerComponent>;
  let component: ReimbursementsManagerComponent;
  let http: HttpTestingController;

  function montar(largura: number, itens: unknown[] = []): void {
    larguraDaJanela(largura);
    TestBed.configureTestingModule({ imports: [ReimbursementsManagerComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(ReimbursementsManagerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    component.month = '2026-09';
    fixture.detectChanges(false);
    responder(itens);
  }

  /** Responde tudo que estiver pendente: lista, totais, funcionários, permissões. */
  function responder(itens: unknown[] = []): TestRequest[] {
    const reqs = http.match(() => true);
    for (const r of reqs) {
      r.flush(r.request.url.endsWith('/summary') ? RESUMO : r.request.url === API ? itens : []);
    }
    fixture.detectChanges(false);
    return reqs;
  }

  function lista(reqs: TestRequest[]): TestRequest | undefined {
    return reqs.find(r => r.request.url === API);
  }

  function chipDe(rotulo: string): HTMLButtonElement {
    const chips = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.chip'));
    const chip = chips.find(c => c.textContent!.includes(rotulo));
    if (!chip) throw new Error(`sem o chip "${rotulo}"`);
    return chip;
  }

  /** O número pequeno do chip, ou null quando não tem. */
  function contagem(rotulo: string): string | null {
    return chipDe(rotulo).querySelector('small')?.textContent?.trim() ?? null;
  }

  afterEach(() => restaurarLargura());

  describe('no celular', () => {
    beforeEach(() => montar(NO_CELULAR));

    it('uma linha compacta e os chips, sem os cartões de total', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.rm-bar')).not.toBeNull();
      expect(el.querySelector('.barra')).withContext('a barra do computador').toBeNull();
      expect(el.querySelector('app-reimbursement-totals')).toBeNull();
      expect(el.querySelectorAll('.chip').length).toBe(5);
    });

    /**
     * No celular a linha das abas não tem espaço: o mesmo período aparece só
     * como ‹ Set 2026 › na barra de Pedidos, e inteiro no topo dos Indicadores.
     */
    it('o período vira ‹ › curto na barra, e inteiro no topo dos Indicadores', async () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.rm-abas__lado')).toBeNull();
      expect(el.querySelector('.rm-bar .pp-nav b')?.textContent).toBe('Set 2026');
      expect(el.querySelector('.rm-bar .pp-gran')).withContext('sem Mês/Trimestre/Ano na barra estreita').toBeNull();

      component.openTab('indicadores');
      fixture.detectChanges(false);
      responder();
      await fixture.whenStable();
      fixture.detectChanges(false);
      const topo = el.querySelector('.rm-periodo-celular') as HTMLElement;
      expect(topo.querySelector('.pp-gran')).not.toBeNull();
      const nav = topo.querySelector('.pp-nav') as HTMLElement;
      expect(nav.getBoundingClientRect().right).withContext('cabe na largura, sem vazar').toBeLessThanOrEqual(topo.getBoundingClientRect().right);
      // O nome de mês mais comprido também: "Fevereiro" tem uma letra a mais que "Setembro".
      for (const mes of ['2026-09', '2026-02']) {
        component.month = mes;
        fixture.detectChanges(false);
        const b = nav.querySelector('b')!;
        expect(b.scrollWidth).withContext(`"${b.textContent}" não é cortado`).toBeLessThanOrEqual(b.clientWidth);
      }
    });

    it('os botões de ícone têm nome para o leitor de tela', () => {
      const nomes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.rm-icon'))
        .map(b => b.getAttribute('aria-label'));
      expect(nomes).toEqual(jasmine.arrayContaining(['Buscar', 'Atualizar']));
      expect(nomes).withContext('o status é chip agora').not.toContain('Filtrar por status');
    });

    it('tocar num chip filtra o mês pelo status e acende só ele', () => {
      const chip = chipDe('A pagar');
      chip.click();

      const req = lista(responder());
      expect(req?.request.params.get('status')).toBe('APPROVED');
      expect(req?.request.params.get('month')).toBe('2026-09');
      expect(chip.getAttribute('aria-pressed')).toBe('true');
      expect(chipDe('Em análise').getAttribute('aria-pressed')).toBe('false');
    });

    it('"Todos" tira o filtro de status', () => {
      chipDe('Todos').click();
      expect(lista(responder())?.request.params.has('status')).toBeFalse();
    });

    /**
     * Opção B da barra de baixo: a tela vai até o pé, e a lista de cartões
     * reserva no FIM o espaço da barra — o último pedido para acima dela.
     */
    it('passa por trás da barra de baixo, com o espaço no fim da lista', () => {
      const host = fixture.nativeElement as HTMLElement;
      const lista = host.querySelector('.pk-cartoes') as HTMLElement | null;
      expect(lista).withContext('lista de cartões do pk-table').not.toBeNull();
      expect(getComputedStyle(lista!).paddingBottom).toBe('82px');
    });

    /** O teclado do iPhone só sobe com o foco dado dentro do toque. */
    it('abrir a busca foca o campo no mesmo toque', () => {
      const input = (fixture.nativeElement as HTMLElement).querySelector('.rm-search input') as HTMLInputElement;
      component.openSearch(input);
      expect(document.activeElement).toBe(input);
      expect(component.searchOpen).toBeTrue();

      input.value = 'diego';
      component.closeSearch(input);
      expect(input.value).toBe('');
    });
  });

  describe('registrar pagamento no celular', () => {
    const APROVADO = {
      id: 'r1', employeeId: 'e1', category: 'Combustível', amount: 92,
      expenseDate: '2026-09-10', status: 'APPROVED',
    };

    beforeEach(() => montar(NO_CELULAR, [APROVADO]));

    /**
     * O padrão da Programação (pedido dele): no celular o calendário sobe de
     * baixo, da altura do conteúdo — e não os 82dvh do formulário, que
     * deixariam meia folha vazia.
     */
    it('abre uma folha curta que sobe de baixo, com o calendário na largura toda', async () => {
      component.openPay(APROVADO as never);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      const painel = document.querySelector('.pk-sheet__painel') as HTMLElement;
      expect(painel).withContext('folha de baixo').not.toBeNull();
      expect(painel.classList).toContain('pk-sheet__painel--ajustada');
      expect(document.querySelector('.p-dialog .pagamento')).withContext('sem diálogo no celular').toBeNull();

      const dia = document.querySelector('.pagamento--folha .p-datepicker-calendar td > span') as HTMLElement;
      expect(Math.round(dia.getBoundingClientRect().height)).toBe(40);
    });
  });

  describe('aprovar e recusar no celular', () => {
    const PENDENTE = {
      id: 'r2', employeeId: 'e1', category: 'Alimentação', amount: 45,
      expenseDate: '2026-09-12', status: 'PENDING',
    };

    beforeEach(() => montar(NO_CELULAR, [PENDENTE]));

    const abrir = async (acao: 'approve' | 'reject') => {
      component.openReview(PENDENTE as never, acao);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);
    };

    /** O pedido dele: aprovar "puxando de baixo", como o registrar pagamento. */
    it('aprovar sobe de baixo, numa folha curta, e não abre diálogo', async () => {
      await abrir('approve');

      const painel = document.querySelector('.pk-sheet__painel') as HTMLElement;
      expect(painel).withContext('folha de baixo').not.toBeNull();
      expect(painel.classList).toContain('pk-sheet__painel--ajustada');
      expect(painel.textContent).toContain('Aprovar reembolso');
      expect(document.querySelector('.p-dialog .revisao')).toBeNull();
    });

    /** Recusar é a mesma janela: sobe igual, e o campo não dá zoom no iPhone. */
    it('recusar também sobe de baixo, com o campo em 16px', async () => {
      await abrir('reject');

      expect(document.querySelector('.pk-sheet__painel')?.textContent).toContain('Recusar reembolso');
      const campo = document.querySelector('.revisao--folha textarea') as HTMLElement;
      expect(getComputedStyle(campo).fontSize).toBe('16px');
    });
  });

  /**
   * Um clique num gráfico dos Indicadores volta para Pedidos com o recorte: a
   * lista vem inteira (o período pode ser trimestre ou ano) e é filtrada aqui.
   */
  describe('o recorte que vem dos Indicadores', () => {
    beforeEach(() => montar(NO_COMPUTADOR));

    it('volta para Pedidos, pede a lista sem mês e filtra pelo recorte', () => {
      component.aba.set('indicadores');
      component.onDrill({ employeeId: 'e1', label: 'Ana · 2026', from: '2026-01-01', to: '2026-12-31' });

      expect(component.aba()).toBe('pedidos');
      expect(component.statusFilter).toBeNull();
      const req = lista(http.match(() => true));
      expect(req?.request.params.has('month')).withContext('sem mês: o período é o do recorte').toBeFalse();
      req!.flush([
        { id: 'a', employeeId: 'e1', expenseDate: '2026-03-10', category: 'Hotel', amount: 10, status: 'PAID' },
        { id: 'b', employeeId: 'e2', expenseDate: '2026-03-10', category: 'Hotel', amount: 10, status: 'PAID' },
        { id: 'c', employeeId: 'e1', expenseDate: '2025-12-31', category: 'Hotel', amount: 10, status: 'PAID' },
      ]);
      expect(component.reimbursements.map(r => r.id)).toEqual(['a']);
    });

    it('a categoria do recorte ignora acento e caixa, como no gráfico', () => {
      component.onDrill({ categoryKey: 'alimentacao', label: 'Alimentação · set', from: '2026-09-01', to: '2026-09-30' });
      lista(http.match(() => true))!.flush([
        { id: 'a', employeeId: 'e1', expenseDate: '2026-09-10', category: 'Alimentação ', amount: 10, status: 'PAID' },
        { id: 'b', employeeId: 'e1', expenseDate: '2026-09-10', category: 'Hotel', amount: 10, status: 'PAID' },
      ]);
      expect(component.reimbursements.map(r => r.id)).toEqual(['a']);
    });

    it('andar o período tira o recorte', () => {
      component.onDrill({ employeeId: 'e1', label: 'Ana · 2026', from: '2026-01-01', to: '2026-12-31' });
      responder();
      component.movePeriod(-1);
      expect(component.recorte()).toBeNull();
      expect(lista(responder())?.request.params.get('month')).toBe('2026-08');
    });
  });

  describe('no computador', () => {
    const APROVADO = {
      id: 'r1', employeeId: 'e1', category: 'Combustível', amount: 92,
      expenseDate: '2026-09-10', status: 'APPROVED',
    };

    beforeEach(() => montar(NO_COMPUTADOR, [APROVADO]));

    /**
     * **O que ele viu:** o "Pagar" era pequeno e o texto passava por cima da
     * linha. O botão herdava o quadrado de 32px dos ícones, e o estilo que o
     * alargaria nunca casava (ver o teste de baixo). Agora é ícone, como os
     * vizinhos — o cifrão que ele pediu — com o nome no `aria-label`.
     */
    it('o Pagar é um botão de ícone com o cifrão, sem texto vazando', async () => {
      // O `p-table` de dentro do `pk-table` desenha as linhas num ciclo seu.
      await fixture.whenStable();
      fixture.detectChanges(false);

      const pagar = (fixture.nativeElement as HTMLElement).querySelector('.action-btn--pay') as HTMLElement;
      expect(pagar).withContext('linha aprovada tem o Pagar').not.toBeNull();

      expect(pagar.querySelector('.pi-dollar')).not.toBeNull();
      expect(pagar.textContent?.trim()).toBe('');
      expect(pagar.getAttribute('aria-label')).toContain('Pagar');
      // Sem rótulo, o quadrado de 32px é o tamanho certo — o mesmo de Aprovar
      // e Recusar. (Não dá para medir o transbordo aqui: o Karma não carrega a
      // fonte dos PrimeIcons, e o glyph de reserva mede mais que o ícone.)
      expect(pagar.querySelector('.p-button-label')).toBeNull();
      expect(Math.round(pagar.getBoundingClientRect().width)).toBe(32);
    });

    /**
     * `&--pay` dentro de `.action-btn.p-button` compila para
     * `.action-btn.p-button--pay`, que não casa com nada — e o build fica
     * verde. Procura a regra de hover de cada um no CSS que o navegador tem.
     */
    it('as cores de hover de Aprovar, Recusar e Pagar existem no CSS de verdade', () => {
      const seletores = Array.from(document.styleSheets)
        .flatMap(folha => { try { return Array.from(folha.cssRules); } catch { return []; } })
        .map(regra => (regra as CSSStyleRule).selectorText ?? '');

      for (const modificador of ['approve', 'reject', 'pay']) {
        expect(seletores.some(sel => sel.includes(`.action-btn--${modificador}`) && sel.includes(':hover')))
          .withContext(modificador).toBeTrue();
      }
    });

    /** O mesmo calendário da Programação: 308px, dias de 36px, e o resumo ao lado. */
    it('registrar pagamento abre o calendário à esquerda e o resumo à direita', async () => {
      component.openPay(APROVADO as never);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      const calendario = document.querySelector('.pagamento--lado .p-datepicker-panel') as HTMLElement;
      const resumo = document.querySelector('.pagamento__resumo') as HTMLElement;
      expect(calendario).withContext('calendário aberto no diálogo').not.toBeNull();
      expect(Math.round(calendario.getBoundingClientRect().width)).toBe(308);
      expect(resumo.getBoundingClientRect().left).toBeGreaterThan(calendario.getBoundingClientRect().right);

      const dia = calendario.querySelector('.p-datepicker-calendar td > span') as HTMLElement;
      expect(Math.round(dia.getBoundingClientRect().width)).toBe(36);
      expect(document.querySelector('.pk-sheet__painel')).withContext('sem folha no computador').toBeNull();
    });

    it('"Hoje" e "Ontem" escolhem o dia num toque, e a frase sai em português', async () => {
      component.openPay(APROVADO as never);
      component.payQuickDate(1);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      expect(component.payDate?.toDateString()).toBe(ontem.toDateString());
      expect(component.isPayDay(1)).toBeTrue();
      expect(component.isPayDay(0)).toBeFalse();

      const frase = document.querySelector('.pagamento__escolha')?.textContent ?? '';
      expect(frase).toMatch(/(domingo|segunda|terça|quarta|quinta|sexta|sábado)/);
    });

    /** No computador continua diálogo — agora com respiro nas bordas. */
    it('aprovar continua diálogo no computador, com padding', async () => {
      component.openReview(APROVADO as never, 'approve');
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      const conteudo = document.querySelector('.p-dialog .revisao') as HTMLElement;
      expect(conteudo).not.toBeNull();
      expect(getComputedStyle(conteudo).paddingLeft).toBe('20px');
      expect(document.querySelector('.pk-sheet__painel')).toBeNull();
    });

    /**
     * Os cartões saíram (2026-09-29), e com eles o seletor de status e a
     * toolbar antiga: a contagem do mês ficou no chip — é o número e o filtro.
     */
    it('a barra de chips no lugar da toolbar e dos cartões de total', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.barra')).not.toBeNull();
      expect(el.querySelector('app-toolbar')).toBeNull();
      expect(el.querySelector('app-reimbursement-totals')).toBeNull();
      expect(el.querySelector('.barra p-select')).withContext('o seletor de status').toBeNull();
      expect(el.querySelector('.rm-bar')).toBeNull();
    });

    /**
     * Opção C: o período e as ações sobem para a linha das abas, com o ‹ ›
     * como o último da direita, junto do Atualizar (pedido dele). A barra fica
     * com o que filtra a lista: os chips e a busca.
     */
    it('o período, o Atualizar e o PDF na linha das abas; chips e busca na barra', () => {
      const el = fixture.nativeElement as HTMLElement;
      const lado = el.querySelector('.rm-abas .rm-abas__lado') as HTMLElement;
      expect(lado).not.toBeNull();
      const filhos = Array.from(lado.children);
      expect(filhos.at(-1)?.tagName).toBe('APP-PERIOD-PICKER');
      expect(filhos.at(-2)?.getAttribute('aria-label')).toBe('Atualizar');

      const barra = el.querySelector('.barra') as HTMLElement;
      expect(barra.querySelector('.chips')).not.toBeNull();
      expect(barra.querySelector('.busca')).not.toBeNull();
      expect(barra.querySelector('app-period-picker')).withContext('o período saiu da barra').toBeNull();
    });

    /** A linha das abas não pode crescer com os controles: é a graça da opção C. */
    it('os controles cabem na linha das abas sem ela crescer', () => {
      const abas = (fixture.nativeElement as HTMLElement).querySelector('.rm-abas') as HTMLElement;
      const aba = abas.querySelector('button[role="tab"]') as HTMLElement;
      const altura = abas.getBoundingClientRect().height;
      expect(altura).toBeLessThanOrEqual(aba.getBoundingClientRect().height + 9 + 1);
    });

    async function abrirAba(indice: number): Promise<TestRequest[]> {
      ((fixture.nativeElement as HTMLElement).querySelectorAll('.rm-abas button[role="tab"]')[indice] as HTMLElement).click();
      fixture.detectChanges(false);
      const reqs = responder();
      await fixture.whenStable();
      fixture.detectChanges(false);
      return reqs;
    }

    function botao(dentro: Element, texto: string): HTMLButtonElement {
      return Array.from(dentro.querySelectorAll('button')).find(b => b.textContent?.trim() === texto)!;
    }

    /**
     * **O que ele viu:** "o seletor de mês ficou um tamanho em cada tab, e
     * ficou duplicado". Eram dois controles diferentes, cada aba com o seu mês.
     * Agora é UM seletor da tela — Mês/Trimestre/Ano e o ‹ › — nas duas abas.
     */
    it('o seletor é o mesmo nas duas abas: mesmo tamanho, mesmo lugar', async () => {
      const el = fixture.nativeElement as HTMLElement;
      const pedidos = el.querySelector('.rm-abas__lado .pp-nav')!.getBoundingClientRect();
      expect(el.querySelector('.rm-abas__lado .pp-gran')).withContext('Mês/Trimestre/Ano em Pedidos também').not.toBeNull();
      await abrirAba(1);
      const indicadores = el.querySelector('.rm-abas__lado .pp-nav')!.getBoundingClientRect();

      expect(el.querySelectorAll('app-period-picker').length).withContext('um seletor só na tela').toBe(1);
      expect(Math.round(indicadores.width)).toBe(Math.round(pedidos.width));
      expect(Math.round(indicadores.right)).toBe(Math.round(pedidos.right));
      expect(Math.round(indicadores.top)).toBe(Math.round(pedidos.top));
    });

    it('o período é um só: escolher Ano nos Indicadores e voltar mostra o ano em Pedidos', async () => {
      const el = fixture.nativeElement as HTMLElement;
      await abrirAba(1);
      botao(el.querySelector('.rm-abas__lado')!, 'Ano').click();
      fixture.detectChanges(false);
      expect(el.querySelector('.pp-nav b')?.textContent).toBe('2026');
      expect(el.querySelector('.ind-vs')?.textContent).withContext('os Indicadores leem o mesmo período').toContain('comparando com 2025');
      expect(lista(http.match(() => true))).withContext('nos Indicadores a lista de Pedidos não é buscada').toBeUndefined();

      const reqs = await abrirAba(0);
      expect(lista(reqs)?.request.params.has('month')).withContext('ano: a lista vem inteira').toBeFalse();
      expect(el.querySelector('.pp-nav b')?.textContent).toBe('2026');
      expect(botao(el.querySelector('.rm-abas__lado')!, 'Ano').getAttribute('aria-pressed')).toBe('true');
    });

    it('voltar para Pedidos recarrega só se o período mudou nos Indicadores', async () => {
      await abrirAba(1);
      ((fixture.nativeElement as HTMLElement).querySelectorAll('.rm-abas button[role="tab"]')[0] as HTMLElement).click();
      expect(lista(http.match(() => true))).withContext('mesmo período: nada a recarregar').toBeUndefined();
    });

    /**
     * Trimestre e ano em Pedidos: a API só filtra por mês, então a lista vem
     * inteira e é cortada aqui — pela data do gasto — e os chips contam o
     * trimestre, da mesma lista que a grade mostra.
     */
    it('no trimestre, a lista é cortada no trimestre e os chips contam ele', () => {
      botao((fixture.nativeElement as HTMLElement).querySelector('.rm-abas__lado')!, 'Trimestre').click();
      const req = lista(http.match(() => true))!;
      expect(req.request.params.has('month')).toBeFalse();
      expect(req.request.params.has('status')).withContext('o status é filtrado aqui, para os chips contarem tudo').toBeFalse();
      req.flush([
        { id: 'a', employeeId: 'e1', expenseDate: '2026-07-02', category: 'Hotel', amount: 10, status: 'PENDING' },
        { id: 'b', employeeId: 'e1', expenseDate: '2026-09-30', category: 'Hotel', amount: 10, status: 'PENDING' },
        { id: 'c', employeeId: 'e1', expenseDate: '2026-08-15', category: 'Hotel', amount: 10, status: 'PAID' },
        { id: 'd', employeeId: 'e1', expenseDate: '2026-06-30', category: 'Hotel', amount: 10, status: 'PENDING' },
        { id: 'e', employeeId: 'e1', expenseDate: '2026-10-01', category: 'Hotel', amount: 10, status: 'PENDING' },
      ]);
      fixture.detectChanges(false);

      expect(component.reimbursements.map(r => r.id)).withContext('Em análise, só no 3º tri').toEqual(['a', 'b']);
      expect(contagem('Em análise')).toBe('2');
      expect(contagem('Pagos')).toBe('1');
      expect(contagem('Todos')).toBe('3');
      expect((fixture.nativeElement as HTMLElement).querySelector('.pp-nav b')?.textContent).toBe('3º tri 2026');
    });

    it('o ‹ › não passa do período de hoje', () => {
      component.month = '2026-09';
      if (component.canGoForward()) return pending('o teste roda depois de setembro de 2026');
      component.movePeriod(1);
      expect(component.month).toBe('2026-09');
      http.expectNone(() => true);
    });

    /** Recusado não vem no resumo: é o pedido (7) menos os outros (2 + 1 + 1). */
    it('cada chip conta o mês inteiro, e o recusado sai da conta', () => {
      expect(contagem('Em análise')).toBe('2');
      expect(contagem('A pagar')).toBe('1');
      expect(contagem('Pagos')).toBe('1');
      expect(contagem('Recusados')).toBe('3');
      expect(contagem('Todos')).toBe('7');
    });

    /** Com um recorte dos Indicadores, os chips contam o recorte — a mesma lista da grade. */
    it('com um recorte dos Indicadores, os chips contam o recorte', () => {
      component.onDrill({ employeeId: 'e1', label: 'Ana · 2026', from: '2026-01-01', to: '2026-12-31' });
      lista(http.match(() => true))!.flush([
        { id: 'a', employeeId: 'e1', expenseDate: '2026-03-10', category: 'Hotel', amount: 10, status: 'PAID' },
        { id: 'b', employeeId: 'e2', expenseDate: '2026-03-10', category: 'Hotel', amount: 10, status: 'PAID' },
      ]);
      fixture.detectChanges(false);
      expect(contagem('Todos')).toBe('1');
      expect(chipDe('Todos').getAttribute('aria-pressed')).toBe('true');
    });

    it('tocar no chip que já está ligado não recarrega', () => {
      chipDe('Em análise').click();
      http.expectNone(() => true);
    });

    it('"Em análise" é o chip sólido: a borda já tem cor desligado', () => {
      chipDe('Todos').click();
      responder();
      const pendente = getComputedStyle(chipDe('Em análise')).borderTopColor;
      const pago = getComputedStyle(chipDe('Pagos')).borderTopColor;
      expect(pendente).not.toBe(pago);
    });
  });
});
