import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';

import { CareerStructureComponent } from './career-structure.component';
import { PositionStore, PositionLevelStore } from '../../../../infrastructure/state/position.store';

/**
 * **O botão "Ver Níveis" não aparecia.**
 *
 * O template usa a diretiva `pButton`, e o `ButtonModule` não estava na lista
 * de `imports` do componente. Diretiva desconhecida em componente standalone é
 * **aviso, não erro**: o build passa, o `<button>` vai para a tela sem o
 * rótulo e sem o ícone — que são inputs da diretiva — e sai um botão vazio.
 *
 * O `.action-btn.p-button` do SCSS prova a intenção: a regra foi escrita para
 * o botão do PrimeNG. O que faltava era só o import.
 *
 * Por isso o teste pergunta ao DOM, e não ao TypeScript: era exatamente o tipo
 * de defeito que compila.
 */
describe('CareerStructureComponent · o botão Ver Níveis', () => {

  const CARGOS = [
    { id: 'cargo-1', name: 'Desenvolvedor' },
    { id: 'cargo-2', name: 'Analista' },
  ];

  async function montar() {
    await TestBed.configureTestingModule({
      imports: [CareerStructureComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        {
          provide: PositionStore,
          useValue: {
            items: signal(CARGOS),
            loading: signal(false),
            load: () => {},
            refresh: () => {},
          },
        },
        {
          provide: PositionLevelStore,
          useValue: {
            levelsOf: () => [],
            isLoading: () => false,
            load: () => {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CareerStructureComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  /** **O teste que pega o defeito.** */
  it('mostra o rótulo "Ver Níveis" na tela', async () => {
    const fixture = await montar();

    const botoes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ) as HTMLButtonElement[];

    const verNiveis = botoes.filter(b => (b.textContent ?? '').includes('Ver Níveis'));

    expect(verNiveis.length)
      .withContext('um por cargo — sem a diretiva, o botão sai vazio e o texto some')
      .toBe(CARGOS.length);
  });

  /**
   * A diretiva do PrimeNG é quem põe a classe `p-button`. Sem ela, o
   * `.action-btn.p-button` do SCSS não casa e o botão fica sem estilo nenhum.
   */
  it('o botão recebe a classe que o SCSS da tela espera', async () => {
    const fixture = await montar();

    const botao = (fixture.nativeElement as HTMLElement)
      .querySelector('button.action-btn') as HTMLButtonElement | null;

    expect(botao).withContext('o botão precisa existir').not.toBeNull();
    expect(botao!.classList)
      .withContext('`.action-btn.p-button` do SCSS depende desta classe')
      .toContain('p-button');
  });

  it('e leva o ícone que a diretiva monta', async () => {
    const fixture = await montar();

    const icone = (fixture.nativeElement as HTMLElement)
      .querySelector('button.action-btn .pi-list');

    expect(icone).not.toBeNull();
  });
});
