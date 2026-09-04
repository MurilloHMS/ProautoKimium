import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { BottomNavComponent } from './bottom-nav.component';
import { MenuService } from '../../../infrastructure/services/menu.service';
import { NotificationService } from '../../../infrastructure/services/notification.service';
import { TelasRecentesService, TelaRecente } from '../../../infrastructure/services/telas-recentes.service';
import { AppMenuItem } from '../menu.config';

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

  const FIXOS: AppMenuItem[] = [
    { label: 'Início', icon: 'pi pi-home', routerLink: ['home'] },
    { label: 'Documentos', icon: 'pi pi-folder', routerLink: ['documentos'] },
    { label: 'Notificações', icon: 'pi pi-bell', routerLink: ['notificacoes'] },
    { label: 'Perfil', icon: 'pi pi-user', routerLink: ['perfil'] },
  ];

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
        { provide: MenuService, useValue: { mobileItems: () => FIXOS } },
        { provide: NotificationService, useValue: { unreadCount: signal(0) } },
        { provide: TelasRecentesService, useValue: recentes },
      ],
    }).compileComponents();

    return TestBed.createComponent(BottomNavComponent).componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('sem histórico nenhum, mostra só os quatro fixos', async () => {
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
      tela('/notificacoes', 'Notificações', 30),
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
