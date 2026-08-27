import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';

import { DocumentosComponent } from './documentos.component';
import { PermissionStore } from '../../../infrastructure/state/permission.store';

/**
 * O hub de Documentos, depois que o "Em breve" saiu.
 *
 * Três cards ficavam meses anunciando telas que não existiam. O que substituiu
 * a promessa foi o controle de acesso: o card aparece quando a pessoa consegue
 * abrir a tela, e some quando não consegue.
 *
 * O que estes testes protegem é a **ausência**, que é o modo de falha desta
 * tela: card a mais leva a pessoa para o acesso negado; card a menos esconde
 * uma pasta que ela poderia usar. Nenhum dos dois dá erro.
 */
describe('DocumentosComponent', () => {
  let fixture: ComponentFixture<DocumentosComponent>;
  let component: DocumentosComponent;

  /** As telas que a pessoa enxerga neste teste. */
  let abertas: string[];

  beforeEach(async () => {
    abertas = [];

    await TestBed.configureTestingModule({
      imports: [DocumentosComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        {
          provide: PermissionStore,
          useValue: { canOpen: (tela: string) => abertas.includes(tela) },
        },
      ],
    }).compileComponents();
  });

  const montar = () => {
    fixture = TestBed.createComponent(DocumentosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const titulos = () => component.categorias().map(c => c.titulo);

  it('mostra só as pastas que a pessoa consegue abrir', () => {
    abertas = ['documentos/galeria', 'documentos/holerites'];
    montar();

    expect(titulos()).toEqual(['Galeria', 'Holerites']);
  });

  /**
   * **O "Pessoal" tinha tela desde sempre.**
   *
   * `documentos/rh` é o Portal do funcionário, e o card ficou meses marcado
   * como "em breve" apontando para lugar nenhum.
   */
  it('o card Pessoal leva ao Portal do funcionário', () => {
    abertas = ['documentos/rh'];
    montar();

    expect(component.categorias()[0].rota).toBe('documentos/rh');
  });

  /**
   * Qualquer uma das sete abre a tela — não só `CONSULTAR`.
   *
   * É o técnico que lança um reembolso sem poder ver os dos outros: ele precisa
   * do card mesmo sem permissão de consulta.
   */
  it('basta ter qualquer permissão na tela para ver o card', () => {
    abertas = ['documentos/logos'];
    montar();

    expect(titulos()).toContain('Logos');
  });

  /**
   * **A página vazia precisa dizer alguma coisa.**
   *
   * Sem esta mensagem, quem não tem acesso a nada abre o hub e vê um retângulo
   * em branco — que parece defeito, e vira chamado.
   */
  it('sem acesso a nada, explica em vez de ficar em branco', () => {
    montar();

    expect(titulos()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('ainda não tem acesso');
  });

  /** E o "Em breve" não existe mais em lugar nenhum da tela. */
  it('nenhum card fica marcado como Em breve', () => {
    abertas = ['documentos/galeria', 'documentos/logos', 'documentos/holerites',
               'documentos/rh', 'tools/pdf'];
    montar();

    expect(fixture.nativeElement.textContent).not.toContain('Em breve');
    expect(titulos().length).toBe(5);
  });
});
