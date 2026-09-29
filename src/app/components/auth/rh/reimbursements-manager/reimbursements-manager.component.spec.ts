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
 * 2×2 ocupavam 226px; sobravam 2 cartões visíveis. Agora a barra tem 52px, a
 * faixa de totais 64px, e o computador continua como era.
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

  afterEach(() => restaurarLargura());

  describe('no celular', () => {
    beforeEach(() => montar(NO_CELULAR));

    it('troca a toolbar pela linha compacta e os totais pela faixa', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-toolbar')).toBeNull();
      expect(el.querySelector('.rm-bar')).not.toBeNull();
      expect(el.querySelector('.rs')).withContext('faixa de totais').not.toBeNull();
      expect(el.querySelector('.rs')?.textContent).toContain('A pagar');
    });

    it('os botões de ícone têm nome para o leitor de tela', () => {
      const nomes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.rm-icon'))
        .map(b => b.getAttribute('aria-label'));
      expect(nomes).toEqual(jasmine.arrayContaining(['Buscar', 'Filtrar por status', 'Atualizar']));
    });

    it('escolher na folha de status filtra, recarrega e fecha', () => {
      component.statusSheetOpen = true;
      component.pickStatus('APPROVED');

      const req = lista(responder());
      expect(req?.request.params.get('status')).toBe('APPROVED');
      expect(req?.request.params.get('month')).toBe('2026-09');
      expect(component.statusSheetOpen).toBeFalse();
    });

    /** Filtro escondido é grade curta sem explicação: o chip mostra e remove. */
    it('o chip mostra o filtro ativo, e remover volta para todos', () => {
      const chip = (fixture.nativeElement as HTMLElement).querySelector('.rm-chip') as HTMLButtonElement;
      expect(chip.textContent).toContain('Em análise');

      chip.click();
      const req = lista(responder());
      expect(req?.request.params.has('status')).toBeFalse();
      expect((fixture.nativeElement as HTMLElement).querySelector('.rm-chip')).toBeNull();
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

    /** Ele: "estão grudadas". Os cartões de total e a grade eram colados. */
    it('há respiro entre os cartões de total e a grade', () => {
      const el = fixture.nativeElement as HTMLElement;
      const cartoes = el.querySelector('.rt') as HTMLElement;
      const grade = el.querySelector('.table-card') as HTMLElement;

      const vao = grade.getBoundingClientRect().top - cartoes.getBoundingClientRect().bottom;
      expect(vao).toBeGreaterThanOrEqual(12);
    });

    it('continua com a toolbar e os cartões de total', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-toolbar')).not.toBeNull();
      expect(el.querySelector('.rm-bar')).toBeNull();
      expect(el.querySelector('.rs')).toBeNull();
      expect(el.querySelector('.rt')).not.toBeNull();
    });
  });
});
