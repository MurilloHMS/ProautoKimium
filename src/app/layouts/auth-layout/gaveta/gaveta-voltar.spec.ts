import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

import { GavetaComponent } from './gaveta.component';
import { AppMenuItem } from '../menu.config';
import { MenuService } from '../../../infrastructure/services/menu.service';
import { TelasRecentesService } from '../../../infrastructure/services/telas-recentes.service';
import { providersDeTeste } from '../../../../testing/test-setup';

/**
 * **O voltar do Android fecha uma camada por vez — não sai da tela.**
 *
 * Era o buraco que sobrava da gaveta: com a pasta aberta, o voltar do aparelho
 * levava a pessoa para a tela anterior e, na volta, a gaveta ainda estava por
 * cima. Num app que o pessoal usa no celular, o voltar é o gesto mais barato
 * que existe, e ele apontava para fora.
 *
 * Como nos outros: `back` e `pushState` são espiados e o voltar entra como
 * `popstate` sintético. O histórico do iframe do Karma é o mesmo da página que
 * o hospeda, e um `back()` de verdade aqui pode levar o runner junto.
 */
describe('GavetaComponent · o voltar do aparelho', () => {

  let fixture: ComponentFixture<GavetaComponent>;
  let gaveta: GavetaComponent;
  let fechou: jasmine.Spy;
  let empilhou: jasmine.Spy;
  let voltou: jasmine.Spy;

  const MENU: AppMenuItem[] = [
    {
      label: 'RH - Recursos Humanos', icon: 'pi pi-users',
      items: [
        { label: 'Painel RH', icon: 'pi pi-chart-bar', routerLink: ['rh/hub'] },
        { label: 'Férias', icon: 'pi pi-sun', routerLink: ['rh/vacation-requests'] },
        { label: 'Reembolsos', icon: 'pi pi-wallet', routerLink: ['rh/reimbursements'] },
        { label: 'Atestados', icon: 'pi pi-heart', routerLink: ['rh/medical-certificates'] },
        { label: 'Funcionários', icon: 'pi pi-users', routerLink: ['rh/employees'] },
      ],
    },
  ];

  /** O voltar do aparelho: caímos numa entrada que não é nossa. */
  function voltarDoAparelho(): void {
    window.dispatchEvent(new PopStateEvent('popstate', { state: { navigationId: 1 } }));
    fixture.detectChanges();
  }

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GavetaComponent],
      providers: [
        ...providersDeTeste(),
        { provide: MenuService, useValue: { menu: () => MENU } },
        { provide: TelasRecentesService, useValue: { porHabito: signal([]) } },
      ],
    }).compileComponents();

    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    empilhou = spyOn(window.history, 'pushState');
    voltou = spyOn(window.history, 'back');

    fixture = TestBed.createComponent(GavetaComponent);
    gaveta = fixture.componentInstance;
    fechou = jasmine.createSpy('closed');
    gaveta.closed.subscribe(fechou);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  }

  it('abrir a gaveta empilha UMA entrada', async () => {
    await montar();

    expect(empilhou).toHaveBeenCalledTimes(1);
  });

  it('abrir a pasta NÃO empilha outra', async () => {
    await montar();
    empilhou.calls.reset();

    gaveta.abrirPasta(gaveta.categorias()[0]);
    fixture.detectChanges();

    expect(empilhou).not.toHaveBeenCalled();
  });

  it('com a pasta aberta, o voltar fecha a pasta e a gaveta FICA', async () => {
    await montar();
    gaveta.abrirPasta(gaveta.categorias()[0]);
    fixture.detectChanges();

    voltarDoAparelho();

    expect(gaveta.pastaAberta()).withContext('a pasta').toBeNull();
    expect(fechou).withContext('a gaveta não fecha junto').not.toHaveBeenCalled();
  });

  it('fechada a pasta, a entrada é REPOSTA para o próximo voltar', async () => {
    await montar();
    gaveta.abrirPasta(gaveta.categorias()[0]);
    fixture.detectChanges();
    empilhou.calls.reset();

    voltarDoAparelho();
    expect(empilhou).withContext('repôs').toHaveBeenCalledTimes(1);

    // E o segundo voltar fecha a gaveta — sem isto ele sairia da tela.
    voltarDoAparelho();
    expect(fechou).toHaveBeenCalledTimes(1);
  });

  it('sem pasta, o voltar fecha a gaveta', async () => {
    await montar();

    voltarDoAparelho();

    expect(fechou).toHaveBeenCalledTimes(1);
  });

  it('o X pede o voltar ao navegador, em vez de fechar por fora', async () => {
    await montar();

    gaveta.fechar();

    expect(voltou).withContext('consome a entrada').toHaveBeenCalledTimes(1);
    // Quem fecha é o popstate que vem depois: um caminho só para o X e para o
    // voltar do aparelho.
    expect(fechou).not.toHaveBeenCalled();
  });

  it('escolher um destino NÃO pede o voltar', async () => {
    await montar();

    gaveta.aoEscolher();

    // O routerLink já navegou; um back() aqui desfaria a navegação que a
    // pessoa acabou de pedir.
    expect(voltou).not.toHaveBeenCalled();
    expect(fechou).toHaveBeenCalledTimes(1);
  });
});
