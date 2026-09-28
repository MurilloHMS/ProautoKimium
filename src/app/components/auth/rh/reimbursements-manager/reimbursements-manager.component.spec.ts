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

  function montar(largura: number): void {
    larguraDaJanela(largura);
    TestBed.configureTestingModule({ imports: [ReimbursementsManagerComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(ReimbursementsManagerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    component.month = '2026-09';
    fixture.detectChanges(false);
    responder();
  }

  /** Responde tudo que estiver pendente: lista, totais, funcionários, permissões. */
  function responder(): TestRequest[] {
    const reqs = http.match(() => true);
    for (const r of reqs) r.flush(r.request.url.endsWith('/summary') ? RESUMO : []);
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

  describe('no computador', () => {
    beforeEach(() => montar(NO_COMPUTADOR));

    it('continua com a toolbar e os cartões de total', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-toolbar')).not.toBeNull();
      expect(el.querySelector('.rm-bar')).toBeNull();
      expect(el.querySelector('.rs')).toBeNull();
      expect(el.querySelector('.rt')).not.toBeNull();
    });
  });
});
