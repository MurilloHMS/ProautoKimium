import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthLayoutComponent } from './auth-layout.component';

import {
  NO_CELULAR,
  NO_COMPUTADOR,
  larguraDaJanela,
  providersDeTeste,
  restaurarLargura,
} from '../../../testing/test-setup';

/**
 * **A gaveta SUBSTITUI a árvore no celular — ela não convive.**
 *
 * Esta é a decisão que justifica apagar a busca, os recentes e as ~170 linhas
 * de CSS `max-width: $bp-md` do `nav-drawer`. Enquanto os dois renderizarem
 * juntos, apagar aquilo tira função de gente que usa; com este teste de pé,
 * apagar é só remover código morto.
 *
 * A razão de substituir é dele, de agosto: cortou a grade de atalhos da home
 * com *"se já existe o menu, pra mim não faz sentido ter os atalhos"*. Uma
 * gaveta ao lado do menu antigo seria o sétimo jeito de navegar no app.
 *
 * **`larguraDaJanela` antes de montar não é cerimônia:** o iframe do Karma tem
 * ~749px e casa com `(max-width: 768px)`, então sem dizer a largura os dois
 * casos deste arquivo rodariam em modo celular e o de desktop passaria sem
 * provar nada.
 */
describe('AuthLayoutComponent · a gaveta no lugar da árvore', () => {

  let fixture: ComponentFixture<AuthLayoutComponent>;

  async function montar(largura: number): Promise<void> {
    larguraDaJanela(largura);

    await TestBed.configureTestingModule({
      imports: [AuthLayoutComponent],
      providers: providersDeTeste(),
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLayoutComponent);
    fixture.detectChanges();
  }

  afterEach(() => restaurarLargura());

  it('no celular monta a gaveta e NÃO monta a árvore', async () => {
    await montar(NO_CELULAR);

    const dom: HTMLElement = fixture.nativeElement;

    expect(dom.querySelector('app-gaveta')).withContext('a gaveta').not.toBeNull();
    expect(dom.querySelector('app-nav-drawer')).withContext('a árvore').toBeNull();
  });

  it('no computador monta a árvore e NÃO monta a gaveta', async () => {
    await montar(NO_COMPUTADOR);

    const dom: HTMLElement = fixture.nativeElement;

    expect(dom.querySelector('app-nav-drawer')).withContext('a árvore').not.toBeNull();
    expect(dom.querySelector('app-gaveta')).withContext('a gaveta').toBeNull();
  });
});
