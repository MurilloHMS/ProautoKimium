import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PkCanDirective } from './pk-can.directive';
import { PermissionStore } from '../state/permission.store';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [PkCanDirective],
  template: `
    <button *pkCan="'stock/movements:EXCLUIR'" id="excluir">Excluir</button>
    <button *pkCan="'stock/movements:ALTERAR'" id="alterar">Alterar</button>
    <button *pkCan="'stock/movements'" id="tela">Qualquer</button>
  `,
})
class HostDeTeste {}

/**
 * A peça que faz o controle **por ação** existir na tela.
 *
 * Antes dela não havia nada parecido: só a galeria escondia algo, com um
 * `isAdmin` cravado no componente.
 *
 * O que se protege aqui é o comportamento **antes** de a resposta chegar. A
 * diretiva monta junto com a tela, e as permissões vêm por HTTP depois — sem
 * reagir, o botão ficaria escondido para sempre em quem abriu a página antes
 * da resposta.
 */
describe('PkCanDirective', () => {
  let http: HttpTestingController;

  const url = `${environment.apiUrl}/me/permissions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostDeTeste],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const montar = () => {
    const fixture = TestBed.createComponent(HostDeTeste);
    fixture.detectChanges();
    return fixture;
  };

  const existe = (fixture: ReturnType<typeof montar>, id: string) =>
    !!fixture.nativeElement.querySelector(`#${id}`);

  const carregar = (mapa: Record<string, string[]>) => {
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(url).flush(mapa);
  };

  /**
   * **Sem permissão, o elemento não existe no DOM** — não é `display: none`.
   *
   * Esconder por CSS deixaria o botão clicável por quem abrisse o inspetor, e a
   * requisição sairia. O 403 da API pegaria, mas o front não pode ser o que
   * convida a tentar.
   */
  it('sem permissão, o botão não é criado', () => {
    carregar({ 'stock/movements': ['ALTERAR'] });
    const fixture = montar();

    expect(existe(fixture, 'excluir')).toBeFalse();
    expect(existe(fixture, 'alterar')).toBeTrue();
  });

  /**
   * **O caso da corrida.**
   *
   * A tela monta antes de a resposta chegar. Sem reagir à chegada, o botão
   * ficaria escondido para sempre — e o sintoma seria "às vezes o botão some",
   * na máquina de quem tem internet ruim.
   */
  it('o botão aparece quando as permissões chegam depois da tela montar', () => {
    const fixture = montar();
    expect(existe(fixture, 'excluir')).toBeFalse();

    carregar({ 'stock/movements': ['EXCLUIR'] });
    fixture.detectChanges();

    expect(existe(fixture, 'excluir')).toBeTrue();
  });

  /** Código sem ação vale a tela toda: `*pkCan="'stock/movements'"`. */
  it('sem ação no código, basta ter qualquer permissão na tela', () => {
    carregar({ 'stock/movements': ['INCLUIR'] });
    const fixture = montar();

    expect(existe(fixture, 'tela')).toBeTrue();
    expect(existe(fixture, 'excluir')).toBeFalse();
  });

  it('tela que não veio no mapa esconde tudo', () => {
    carregar({ 'rh/hub': ['CONSULTAR'] });
    const fixture = montar();

    expect(existe(fixture, 'excluir')).toBeFalse();
    expect(existe(fixture, 'alterar')).toBeFalse();
    expect(existe(fixture, 'tela')).toBeFalse();
  });
});
