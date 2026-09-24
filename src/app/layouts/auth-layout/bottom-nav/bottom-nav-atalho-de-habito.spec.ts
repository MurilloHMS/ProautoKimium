import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { BottomNavComponent } from './bottom-nav.component';
import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService, TelaRecente } from '../../../infrastructure/services/telas-recentes.service';
import { MOBILE_NAV } from '../menu.config';

/**
 * **O quinto atalho da barra de baixo.**
 *
 * A barra tem quatro fixos e um quinto lugar para o hábito: a tela que a pessoa
 * mais abre. A regra antiga pegava a mais visitada e desistia se ela já
 * estivesse entre os fixos — **sem procurar a seguinte**.
 *
 * Isso matava o quinto lugar no celular. A Início está no `APP_MENU`, então
 * cada visita a ela conta; e a Início é onde o app abre e onde o login cai,
 * então ela é quase sempre a mais visitada de um celular. O resultado é que a
 * presença dela na barra escondia o atalho que a barra existia para mostrar.
 *
 * E quando aparecia, piscava: com o registro zerado, uma visita a outra tela
 * empatava e ganhava no desempate por recência — depois duas voltas à Início
 * faziam o atalho sumir de novo.
 */
describe('BottomNavComponent · o quinto atalho', () => {

  // O fake devolve o MOBILE_NAV de verdade, e nao uma copia: a lista ja mudou
  // uma vez (Notificacoes saiu para o "Apps" entrar) e a copia local ficou
  // para tras, quebrando quatro testes por contagem. Lendo a fonte, ela nao
  // diverge de novo.
  //
  // A barra mostra MOBILE_NAV + o botao "Apps", que o componente insere.

  const tela = (path: string, label: string, visitas: number, quando = 0): TelaRecente => ({
    path, label, icon: 'pi pi-file', breadcrumb: label, visitas, ultimoAcesso: quando,
  });

  /** Monta a barra com um registro de telas recentes controlado pelo teste. */
  async function montar(registro: TelaRecente[]): Promise<BottomNavComponent> {
    const ordenado = [...registro]
      .sort((a, b) => b.visitas - a.visitas || b.ultimoAcesso - a.ultimoAcesso);

    const recentes = { porHabito: signal(ordenado) };

    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MenuService, useValue: { mobileItems: () => MOBILE_NAV } },
        { provide: TelasRecentesService, useValue: recentes },
      ],
    }).compileComponents();

    return TestBed.createComponent(BottomNavComponent).componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('sem histórico nenhum, mostra só os fixos mais o Apps', async () => {
    const barra = await montar([]);

    expect(barra.items().length).toBe(4);
  });

  /** **O teste que pega o defeito.** */
  it('a Início ser a mais visitada não pode esconder o quinto atalho', async () => {
    const barra = await montar([
      tela('/home', 'Início', 40),
      tela('/programacao', 'Programação', 12),
      tela('/estoque', 'Estoque', 3),
    ]);

    expect(barra.items().length)
      .withContext('a Início já está na barra; o hábito seguinte é que merece o lugar')
      .toBe(5);

    expect(barra.items()[4].label).toBe('Programação');
  });

  it('pula quantos fixos forem precisos até achar uma tela de fora', async () => {
    const barra = await montar([
      tela('/home', 'Início', 40),
      tela('/perfil', 'Perfil', 20),
      tela('/documentos', 'Documentos', 10),
      tela('/estoque', 'Estoque', 2),
    ]);

    expect(barra.items().length).toBe(5);
    expect(barra.items()[4].label).toBe('Estoque');
  });

  it('se TUDO que a pessoa abre já está na barra, não inventa um quinto', async () => {
    const barra = await montar([
      tela('/home', 'Início', 40),
      tela('/documentos', 'Documentos', 10),
    ]);

    expect(barra.items().length).toBe(4);
  });

  // ── o botão Apps ──────────────────────────────────────────────────────────

  /**
   * "Apps" entrou no lugar de Notificações, e abre a gaveta em vez de navegar.
   * Como não leva a lugar nenhum, ele não pode ser link: o leitor de tela
   * anunciaria errado e o toque longo ofereceria "abrir em nova aba".
   */
  it('o Apps esta na terceira posicao, e nao e um destino', async () => {
    const barra = await montar([]);

    expect(barra.items()[2].label).toBe('Apps');
    expect(barra.items()[2].acao).toBe('apps');
    expect(barra.items()[2].routerLink).toEqual([]);
  });

  it('tocar no Apps avisa o shell, que e quem abre a gaveta', async () => {
    const barra = await montar([]);

    let pediu = false;
    barra.apps.subscribe(() => (pediu = true));

    barra.apps.emit();

    expect(pediu).toBeTrue();
  });

  /**
   * A pílula marca onde a pessoa está. O Apps abre uma camada por cima, e a
   * tela de trás continua sendo a atual — se ele pudesse ficar ativo, a pílula
   * apontaria para um item que não é lugar nenhum.
   */
  it('o Apps nunca fica ativo', async () => {
    const barra = await montar([]);

    expect(barra.indiceAtivo()).not.toBe(2);
  });

  /**
   * O atalho não pode trocar a cada navegação: uma barra que muda de item é
   * pior que uma barra fixa. Duas visitas à Início não mexem no quinto lugar.
   */
  it('não pisca quando a pessoa volta para a Início', async () => {
    const antes = await montar([
      tela('/home', 'Início', 1, 100),
      tela('/programacao', 'Programação', 1, 200),
    ]);

    expect(antes.items()[4].label).toBe('Programação');

    TestBed.resetTestingModule();

    const depois = await montar([
      tela('/home', 'Início', 3, 300),
      tela('/programacao', 'Programação', 1, 200),
    ]);

    expect(depois.items().length)
      .withContext('a Início subiu, mas o hábito de fora continua sendo Programação')
      .toBe(5);
    expect(depois.items()[4].label).toBe('Programação');
  });
});
