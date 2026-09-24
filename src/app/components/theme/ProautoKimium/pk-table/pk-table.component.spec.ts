import { Component, ViewChild, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkTableComponent } from './pk-table.component';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * A tabela do tema, agora com modo cartão no celular.
 *
 * <p><b>O que estes testes guardam.</b> A tabela do PrimeNG continua montada no
 * celular, sem linhas e escondida — e isso <i>parece</i> desperdício até se
 * lembrar do motivo: o {@code @ViewChild('dt', { static: true })} não enxerga
 * dentro de um {@code @if}, e é esse {@code dt} que o provider de
 * {@code Table} serve às diretivas do cabeçalho projetado das telas
 * ({@code pSortableColumn}). Pôr a tabela num {@code @if} deixa {@code dt}
 * indefinido <b>também no desktop</b>, e a ordenação morre calada.
 */
@Component({
  standalone: true,
  imports: [PkTableComponent],
  template: `
    <pk-table
      [data]="linhas()"
      [filterFields]="['nome', 'setor']"
      totalLabel="equipamentos"
      emptyTitle="Nenhum equipamento">

      <ng-template #headerTpl>
        <tr><th>Nome</th><th>Setor</th></tr>
      </ng-template>

      <ng-template #bodyTpl let-e>
        <tr class="linha-tabela"><td>{{ e.nome }}</td><td>{{ e.setor }}</td></tr>
      </ng-template>

      @if (comCartao()) {
        <ng-template #cardTpl let-e>
          <article class="pk-cartao">
            <button type="button" class="pk-cartao__corpo" (click)="abriu.set(e.nome)">
              <span class="pk-cartao__titulo">{{ e.nome }}</span>
            </button>
          </article>
        </ng-template>
      }
    </pk-table>
  `,
})
class HospedeiroDeTeste {
  @ViewChild(PkTableComponent) tabela!: PkTableComponent<{ nome: string; setor: string }>;

  readonly comCartao = signal(true);
  readonly abriu = signal('');
  readonly linhas = signal([
    { nome: 'Lavadora de Alta Pressão', setor: 'Manutenção' },
    { nome: 'Compressor Parafuso 30cv', setor: 'Produção' },
    { nome: 'Empilhadeira Elétrica', setor: 'Logística' },
  ]);
}

describe('PkTableComponent', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;

  function fingirLargura(ehCelular: boolean): void {
    spyOn(window, 'matchMedia').and.returnValue({
      matches: ehCelular,
      media: '(max-width: 768px)',
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => true,
    } as unknown as MediaQueryList);
  }

  async function montar(ehCelular: boolean, comCartao = true): Promise<void> {
    fingirLargura(ehCelular);

    await TestBed.configureTestingModule({
      imports: [HospedeiroDeTeste],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.componentInstance.comCartao.set(comCartao);
    fixture.detectChanges();
  }

  const raiz = () => fixture.nativeElement as HTMLElement;

  // ── Desktop ───────────────────────────────────────────────────────────────

  it('no desktop mostra a tabela, e nenhum cartao', async () => {
    await montar(false);

    expect(raiz().querySelectorAll('.linha-tabela').length).toBe(3);
    expect(raiz().querySelector('.pk-cartao')).toBeNull();
  });

  /**
   * <b>O defeito que custa a ordenação.</b> O `dt` precisa existir no desktop,
   * porque o provider de `Table` deste componente o serve ao `pSortableColumn`
   * que as telas põem no cabeçalho.
   */
  it('no desktop o dt existe, que e do que a ordenacao das telas depende', async () => {
    await montar(false);

    expect(fixture.componentInstance.tabela.dt)
      .withContext('sem dt, pSortableColumn das telas para de ordenar em silencio')
      .toBeTruthy();
  });

  // ── Celular ───────────────────────────────────────────────────────────────

  it('no celular mostra cartoes, e nenhuma linha de tabela', async () => {
    await montar(true);

    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(3);
    expect(raiz().querySelectorAll('.linha-tabela').length)
      .withContext('a tabela continua montada, mas o aparelho nao monta linha nenhuma')
      .toBe(0);
  });

  it('no celular o dt continua existindo, e a casca da tabela fica escondida', async () => {
    await montar(true);

    expect(fixture.componentInstance.tabela.dt).toBeTruthy();
    expect((raiz().querySelector('.pk-table-card') as HTMLElement).hidden).toBeTrue();
  });

  /**
   * Tela que não ofereceu cartão não pode perder a tabela: o modo é opcional, e
   * as dezenove migram uma a uma.
   */
  it('sem cardTpl, o celular continua com a tabela de antes', async () => {
    await montar(true, false);

    expect(raiz().querySelectorAll('.linha-tabela').length).toBe(3);
    expect(raiz().querySelector('.pk-cartoes')).toBeNull();
  });

  // ── Busca ─────────────────────────────────────────────────────────────────

  /**
   * A busca da toolbar das telas chama `filterGlobal`. No celular não existe
   * PrimeNG para receber — se o método só falasse com ele, a busca ficaria
   * digitando no vazio.
   */
  it('a busca da tela filtra os cartoes, e nao so a tabela', async () => {
    await montar(true);

    fixture.componentInstance.tabela.filterGlobal('compressor');
    fixture.detectChanges();

    const titulos = Array.from(raiz().querySelectorAll('.pk-cartao__titulo'))
      .map(e => e.textContent?.trim());

    expect(titulos).toEqual(['Compressor Parafuso 30cv']);
  });

  it('a busca ignora acento, como a da tabela', async () => {
    await montar(true);

    fixture.componentInstance.tabela.filterGlobal('eletrica');
    fixture.detectChanges();

    expect(raiz().querySelectorAll('.pk-cartao').length)
      .withContext('"Elétrica" tem que ser achada por "eletrica"')
      .toBe(1);
  });

  it('a busca olha todos os filterFields, e nao so o primeiro', async () => {
    await montar(true);

    fixture.componentInstance.tabela.filterGlobal('logística');
    fixture.detectChanges();

    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(1);
  });

  it('busca sem resultado mostra o vazio, e nao uma lista em branco', async () => {
    await montar(true);

    fixture.componentInstance.tabela.filterGlobal('nao existe');
    fixture.detectChanges();

    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(0);
    expect(raiz().querySelector('pk-empty')).not.toBeNull();
  });

  // ── Lote ──────────────────────────────────────────────────────────────────

  /**
   * Vinte de cada vez. Sem corte, uma tela de 900 linhas monta 900 cartões no
   * aparelho mais fraco do galpão.
   */
  it('acima de vinte linhas corta o lote e oferece mostrar mais', async () => {
    await montar(true);

    fixture.componentInstance.linhas.set(
      Array.from({ length: 25 }, (_, i) => ({ nome: `Item ${i}`, setor: 'Produção' })));
    fixture.detectChanges();

    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(20);

    const mais = raiz().querySelector('.pk-cartoes__mais') as HTMLButtonElement;
    expect(mais).not.toBeNull();

    mais.click();
    fixture.detectChanges();

    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(25);
    expect(raiz().querySelector('.pk-cartoes__mais'))
      .withContext('acabou a lista, some o botao')
      .toBeNull();
  });

  /** Buscar de novo tem que voltar ao primeiro lote, e não continuar no terceiro. */
  it('buscar volta o lote ao comeco', async () => {
    await montar(true);

    fixture.componentInstance.linhas.set(
      Array.from({ length: 60 }, (_, i) => ({ nome: `Item ${i}`, setor: 'Produção' })));
    fixture.detectChanges();

    (raiz().querySelector('.pk-cartoes__mais') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(40);

    fixture.componentInstance.tabela.filterGlobal('Item');
    fixture.detectChanges();

    expect(raiz().querySelectorAll('.pk-cartao').length).toBe(20);
  });

  // ── O cartão abre o formulário ────────────────────────────────────────────

  it('o corpo do cartao e um botao, e avisa a tela', async () => {
    await montar(true);

    const corpo = raiz().querySelector('.pk-cartao__corpo') as HTMLButtonElement;

    expect(corpo.tagName)
      .withContext('div clicavel nao alcanca o teclado nem o leitor de tela')
      .toBe('BUTTON');

    corpo.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.abriu()).toBe('Lavadora de Alta Pressão');
  });
});
