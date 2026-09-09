import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CustomerReconciliationComponent } from './customer-reconciliation.component';
import { CustomerReconciliationService } from '../../../../../infrastructure/services/partners/customer/customer-reconciliation.service';
import type {
  Reconciliation,
  ReconciliationRow,
} from '../../../../../domain/models/customer-reconciliation.model';

/**
 * A tela de conciliação.
 *
 * Os números vêm da medição de 2026-09-09: 2008 linhas do ERP contra ~7,4 mil
 * clientes daqui, e 1734 iguais para 61 que mudaram.
 *
 * **O que estes testes protegem é a marcação.** Uma caixa que marca o que a
 * busca escondeu aplica o que ninguém viu; uma que marca linha impedida promete
 * uma gravação que o servidor recusa. Nenhum dos dois dá erro na tela.
 */
describe('CustomerReconciliationComponent', () => {

  const row = (code: string, name: string, extra: Partial<ReconciliationRow> = {}): ReconciliationRow => ({
    code, name,
    document: '12345678000199',
    email: `${code}@x.com`,
    matrizCode: code,
    active: true,
    signature: `sig-${code}`,
    differences: [],
    impediments: [],
    ...extra,
  });

  const DATA: Reconciliation = {
    toCreate: [
      row('8805', 'EXAL VESUVIUS'),
      row('7712', 'METALCORP', {
        impediments: [{ reason: 'EMAIL_INVALID', detail: 'E-mail inválido no ERP: compras@' }],
      }),
    ],
    toUpdate: [
      row('8781', 'TEMPERO CERTO', {
        differences: [
          { field: 'email', localValue: 'antigo@x.com', erpValue: 'novo@x.com' },
          { field: 'codigoMatriz', localValue: '1711', erpValue: '10' },
        ],
      }),
    ],
    toDeactivate: [row('4', 'UPBUS', { active: false })],
    unchanged: 1734,
  };

  let service: jasmine.SpyObj<CustomerReconciliationService>;
  let screen: CustomerReconciliationComponent;
  let fixture: ComponentFixture<CustomerReconciliationComponent>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const find = (selector: string) => (fixture.nativeElement as HTMLElement).querySelectorAll(selector);

  /**
   * A janela do Karma é um iframe estreito, então `max-width: 768px` casa por
   * padrão e a tela nasce em modo celular — o teste da tabela conferiria os
   * cartões e passaria verde olhando o elemento errado.
   */
  function widthOf(px: number): void {
    const frame = window.frameElement as HTMLElement | null;
    if (!frame) throw new Error('Sem iframe: este teste depende da largura da janela.');
    frame.style.width = `${px}px`;
    frame.getBoundingClientRect();
  }

  const DESKTOP = 1280;

  const PHONE = 390;

  async function mount(data: Reconciliation = DATA, width = DESKTOP) {
    // A largura precisa valer ANTES de montar: o componente lê o matchMedia no
    // construtor, e mudá-la depois não refaz a decisão.
    widthOf(width);

    service = jasmine.createSpyObj<CustomerReconciliationService>(
      'CustomerReconciliationService', ['preview', 'apply']);
    service.preview.and.returnValue(of(data));

    await TestBed.configureTestingModule({
      imports: [CustomerReconciliationComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: CustomerReconciliationService, useValue: service },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerReconciliationComponent);
    screen = fixture.componentInstance;
    fixture.detectChanges();
    return screen;
  }

  afterEach(() => {
    const frame = window.frameElement as HTMLElement | null;
    if (frame) frame.style.width = '';
    TestBed.resetTestingModule();
  });

  // ── Buscar ────────────────────────────────────────────────────────────────

  it('abre sem consultar nada, explicando o que fazer', async () => {
    await mount();

    expect(service.preview).not.toHaveBeenCalled();
    expect(find('pk-empty').length).toBe(1);
    expect(text()).toContain('nada é gravado sem você marcar');
  });

  it('manda os meses escolhidos, e não uma data', async () => {
    await mount();

    screen.months.set(24);
    screen.load();

    expect(service.preview).toHaveBeenCalledOnceWith(24);
  });

  it('desenha os três baldes e a contagem dos iguais', async () => {
    await mount();
    screen.load();
    fixture.detectChanges();

    expect(find('pk-kpi').length).toBe(4);
    expect(find('.secao').length).toBe(3);
    expect(text()).toContain('1734 clientes já estão iguais');
  });

  // ── A marcação ────────────────────────────────────────────────────────────

  /**
   * **Impedimento trava a linha inteira** — decisão dele. Deixar marcar
   * prometeria uma gravação que o servidor recusa, e a pessoa só descobriria
   * no resultado.
   */
  it('linha impedida não tem caixa, e mostra o motivo', async () => {
    await mount();
    screen.load();
    fixture.detectChanges();

    const blocked = Array.from(find('tr.imped'));
    expect(blocked.length).toBe(1);
    expect(blocked[0].querySelector('input[type="checkbox"]')).toBeNull();
    expect(blocked[0].textContent).toContain('compras@');
  });

  it('marcar linha impedida não faz nada', async () => {
    await mount();
    screen.load();

    screen.toggle(DATA.toCreate[1]);

    expect(screen.selectedCount()).toBe(0);
  });

  /** Marcar o que a busca escondeu aplicaria o que ninguém viu. */
  it('marcar todos respeita o filtro e pula os impedidos', async () => {
    await mount();
    screen.load();
    screen.search.set('EXAL');
    fixture.detectChanges();

    screen.toggleAll('toCreate');

    expect(screen.selectedCount())
      .withContext('só o EXAL está visível; o METALCORP está filtrado e impedido')
      .toBe(1);
  });

  it('a conta do rodapé separa criar, atualizar e desativar', async () => {
    await mount();
    screen.load();

    screen.toggle(DATA.toCreate[0]);
    screen.toggle(DATA.toUpdate[0]);
    screen.toggle(DATA.toDeactivate[0]);

    expect(screen.tally()).toEqual({ created: 1, updated: 1, deactivated: 1 });
  });

  // ── As diferenças ─────────────────────────────────────────────────────────

  it('mostra os dois lados de cada campo alterado', async () => {
    await mount();
    screen.load();
    fixture.detectChanges();

    expect(text()).toContain('antigo@x.com');
    expect(text()).toContain('novo@x.com');
  });

  /**
   * **Mudança de grupo não é um campo como e-mail.** Ela muda quem enxerga o
   * quê no portal do cliente, e o caminho de volta tira acesso de alguém — por
   * isso tem faixa própria.
   */
  it('mudança de grupo é destacada das outras diferenças', async () => {
    await mount();
    screen.load();
    fixture.detectChanges();

    expect(find('.diff--grupo').length).toBe(1);
    expect(find('.diff').length)
      .withContext('e-mail e grupo, mas só o grupo em destaque')
      .toBe(2);
  });

  // ── Os filtros ────────────────────────────────────────────────────────────

  /**
   * Três baldes empilhados viram uma página longa. O filtro mostra uma seção por
   * vez — e o de impedidos é a lista que se abre para ir consertar no ERP.
   */
  it('o filtro mostra uma seção por vez', async () => {
    await mount();
    screen.load();
    fixture.detectChanges();
    expect(find('.secao').length).toBe(3);

    screen.filter.set('toUpdate');
    fixture.detectChanges();

    expect(find('.secao').length).toBe(1);
    expect(text()).toContain('Com diferença');
    expect(text()).not.toContain('Inativos no ERP —');
  });

  /**
   * Os impedidos dos três baldes juntos. Espalhados nas seções deles, eles não
   * servem para o trabalho que essa lista existe para apoiar.
   */
  it('o filtro de impedidos junta os três baldes', async () => {
    await mount();
    screen.load();

    screen.filter.set('blocked');
    fixture.detectChanges();

    expect(screen.blocked().map(r => r.code)).toEqual(['7712']);
    expect(find('.secao').length).toBe(1);
    expect(text()).toContain('compras@');
  });

  it('sem impedimento, o filtro diz isso em vez de mostrar tabela vazia', async () => {
    await mount({ ...DATA, toCreate: [DATA.toCreate[0]] });
    screen.load();

    screen.filter.set('blocked');
    fixture.detectChanges();

    expect(screen.blocked().length).toBe(0);
    expect(text()).toContain('Nenhum impedimento');
  });

  /** A busca continua valendo dentro do filtro. */
  it('filtro e busca se somam', async () => {
    await mount();
    screen.load();

    screen.filter.set('toCreate');
    screen.search.set('EXAL');
    fixture.detectChanges();

    expect(screen.toCreate().length).toBe(1);
    expect(screen.toUpdate().length).toBe(0);
  });

  // ── Aplicar ───────────────────────────────────────────────────────────────

  /**
   * Vai **código e assinatura**, e não o que fazer: é a assinatura que faz o
   * servidor recusar uma linha que mudou no ERP desde que a tela foi aberta.
   */
  it('aplica mandando código e assinatura das marcadas', async () => {
    await mount();
    screen.load();
    service.apply.and.returnValue(of({ created: 1, updated: 0, deactivated: 0, skipped: 0, lines: [] }));

    screen.toggle(DATA.toCreate[0]);
    screen.apply();

    expect(service.apply).toHaveBeenCalledOnceWith(12, [{ code: '8805', signature: 'sig-8805' }]);
  });

  it('sem marcação não aplica', async () => {
    await mount();
    screen.load();

    screen.apply();

    expect(service.apply).not.toHaveBeenCalled();
  });

  it('depois de aplicar, recarrega e avisa o pai', async () => {
    await mount();
    screen.load();
    service.apply.and.returnValue(of({ created: 1, updated: 0, deactivated: 0, skipped: 0, lines: [] }));

    const applied = spyOn(screen.applied, 'emit');
    screen.toggle(DATA.toCreate[0]);
    screen.apply();

    expect(applied).toHaveBeenCalled();
    expect(service.preview)
      .withContext('a grade do pai e a própria prévia ficaram velhas')
      .toHaveBeenCalledTimes(2);
  });

  it('erro ao aplicar volta para a revisão sem perder a seleção', async () => {
    await mount();
    screen.load();
    service.apply.and.returnValue(throwError(() => ({ error: { message: 'falhou' } })));

    screen.toggle(DATA.toCreate[0]);
    screen.apply();

    expect(screen.state()).toBe('reviewing');
    expect(screen.selectedCount()).toBe(1);
  });

  // ── Celular ───────────────────────────────────────────────────────────────

  /**
   * `@if` e não `display: none`: as linhas têm caixa de seleção, e escondida
   * por CSS ela continua no foco e no leitor de tela.
   */
  it('no celular troca a tabela por cartões', async () => {
    await mount(DATA, PHONE);
    screen.load();
    fixture.detectChanges();

    expect(screen.isPhone())
      .withContext('a largura da janela decide, não uma bandeira do teste')
      .toBeTrue();
    expect(find('.cartao').length).toBeGreaterThan(0);
    expect(find('.secao .tab').length)
      .withContext('a seção de novos não pode desenhar tabela no celular')
      .toBeLessThan(3);
  });

  it('no computador desenha tabela, e não cartões', async () => {
    await mount(DATA, DESKTOP);
    screen.load();
    fixture.detectChanges();

    expect(screen.isPhone()).toBeFalse();
    expect(find('.cartao').length).toBe(0);
    expect(find('.tab').length).toBe(3);
  });
});
