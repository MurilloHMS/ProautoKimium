import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PermissionUsersComponent } from './permission-users.component';
import { PermissionAdminService } from '../../../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../../../infrastructure/state/permission.store';
import {
  ScreenRow, TemplateSummary, UserGrid, UserSummary,
} from '../../../../../domain/models/permission-admin.model';

/**
 * A tela que carimba modelo em gente.
 *
 * O teste que dá nome a este arquivo é o do **diálogo**, e ele existe por um
 * defeito real: o `pk-dialog` projeta por atributo (`pkDialogContent`), e sem
 * esse atributo ele abre **vazio**. Nada quebra — o build passa, o console fica
 * limpo, a caixa aparece na tela sem nada dentro.
 *
 * É a família de falha que já mordeu este projeto antes: componente montado sem
 * o que ele precisava, e o sintoma sendo só a ausência de alguma coisa.
 */
describe('PermissionUsersComponent', () => {
  let fixture: ComponentFixture<PermissionUsersComponent>;
  let component: PermissionUsersComponent;
  let api: jasmine.SpyObj<PermissionAdminService>;

  const TELAS: ScreenRow[] = [
    { code: 'stock/movements', label: 'Movimentações', module: 'Estoque', sortOrder: 10 },
  ];

  const MODELOS: TemplateSummary[] = [
    { id: 't-vendedor', name: 'VENDEDOR', description: null, active: true,
      allowedCells: 7, stampedUsers: 2 },
    { id: 't-almox', name: 'ALMOXARIFADO', description: null, active: true,
      allowedCells: 9, stampedUsers: 3 },
  ];

  const PESSOAS: UserSummary[] = [
    { id: 'u-1', name: 'Weslley Almeida', login: 'weslley', active: true, templates: ['Base'] },
    { id: 'u-2', name: 'Ricardo Souza', login: 'ricardo', active: true, templates: [] },
  ];

  const GRADE: UserGrid = {
    id: 'u-1', name: 'Weslley Almeida', login: 'weslley',
    cells: { 'stock/movements': ['CONSULTAR'] },
    stamped: { 'stock/movements': ['CONSULTAR', 'EXCLUIR'] },
    appliedTemplates: [],
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PermissionAdminService>('PermissionAdminService', [
      'screens', 'templates', 'users', 'userGrid', 'saveUserGrid', 'apply', 'copyFrom',
    ]);
    api.screens.and.returnValue(of(TELAS));
    api.templates.and.returnValue(of(MODELOS));
    api.users.and.returnValue(of(PESSOAS));
    api.userGrid.and.returnValue(of(GRADE));
    api.apply.and.returnValue(of({ users: 1, cellsChanged: 7 }));

    await TestBed.configureTestingModule({
      imports: [PermissionUsersComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: PermissionAdminService, useValue: api },
        // Quem abre esta tela tem tudo — o que se testa aqui não é a porta.
        { provide: PermissionStore, useValue: { can: () => true, canOpen: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** O diálogo do PrimeNG é modal e pode sair do elemento do componente. */
  const noDialogo = (seletor: string) => document.body.querySelector(seletor);

  afterEach(() => {
    component.applyOpen.set(false);
    component.copyOpen.set(false);
    fixture.detectChanges();
  });

  // ─── O contrato de projeção ───────────────────────────────────────────────

  /**
   * **O teste do diálogo vazio.**
   *
   * Sem `pkDialogContent` no conteúdo, o `pk-dialog` abre e não mostra nada —
   * e nenhuma camada reclama. Este teste falha na hora em que alguém copiar um
   * diálogo esquecendo o atributo.
   */
  it('o diálogo de aplicar modelo abre COM conteúdo dentro', () => {
    component.openApplyToCurrent();
    fixture.detectChanges();

    expect(noDialogo('.pform__mode'))
      .withContext('as duas opções de modo têm que estar dentro do diálogo')
      .not.toBeNull();
    expect(noDialogo('.pform__chip'))
      .withContext('os modelos para escolher')
      .not.toBeNull();
    expect(noDialogo('.pform__person'))
      .withContext('as pessoas para marcar')
      .not.toBeNull();
  });

  /**
   * O rodapé usa a classe do tema, e não uma minha.
   *
   * `pk-dialog-footer` é quem traz padding, traço e alinhamento à direita — o
   * `pk-dialog` zera os dois slots de propósito, esperando que o conteúdo use
   * `pk-form-section` e o rodapé use esta classe. Recriar isso por fora foi o
   * que deixou os diálogos sem respiro.
   */
  it('o rodapé do diálogo usa a classe do tema e traz os botões', () => {
    component.openApplyToCurrent();
    fixture.detectChanges();

    expect(noDialogo('.pk-dialog-footer pk-button')).not.toBeNull();
  });

  /** O conteúdo respira porque está numa seção do tema, não numa div solta. */
  it('o conteúdo do diálogo vive dentro de pk-form-section', () => {
    component.openApplyToCurrent();
    fixture.detectChanges();

    expect(noDialogo('.pk-form-section .pform__mode')).not.toBeNull();
  });

  it('o diálogo de copiar também abre com conteúdo', () => {
    component.openCopy();
    fixture.detectChanges();

    expect(noDialogo('.pform__person')).not.toBeNull();
  });

  // ─── Comportamento ────────────────────────────────────────────────────────

  /**
   * Abrir pela pessoa aberta já vem com ela marcada.
   *
   * Sem isso o caminho mais comum — carimbar quem está na tela — exigiria
   * procurar a própria pessoa numa lista de sete.
   */
  it('aplicar a partir da pessoa aberta já vem com ela marcada', () => {
    component.openApplyToCurrent();

    expect(component.applyTargets()).toEqual(['u-1']);
  });

  it('aplicar a vários abre sem ninguém marcado', () => {
    component.openApplyToMany();

    expect(component.applyTargets()).toEqual([]);
  });

  /**
   * **SOMAR é o padrão, e isso não é detalhe.**
   *
   * Se o diálogo abrisse em SUBSTITUIR, o clique distraído no caminho mais
   * comum apagaria ajuste individual de todo mundo que ele alcança.
   */
  it('o modo começa em SOMAR', () => {
    component.openApplyToMany();

    expect(component.applyMode()).toBe('SOMAR');
  });

  it('aplicar manda o modelo, as pessoas e o modo escolhidos', () => {
    component.openApplyToCurrent();
    component.applyTemplateId.set('t-almox');
    component.toggleTarget('u-2');
    component.applyMode.set('SUBSTITUIR');

    component.confirmApply();

    expect(api.apply).toHaveBeenCalledWith('t-almox', ['u-1', 'u-2'], 'SUBSTITUIR');
  });

  it('sem ninguém marcado, não chama a API', () => {
    component.openApplyToMany();

    component.confirmApply();

    expect(api.apply).not.toHaveBeenCalled();
  });

  // ─── A divergência ────────────────────────────────────────────────────────

  /**
   * O número que o aviso do topo mostra.
   *
   * A grade veio com `CONSULTAR` ligada e o carimbo dava `CONSULTAR` e
   * `EXCLUIR` — então uma célula difere: a que alguém desligou.
   */
  it('conta as células que diferem dos carimbos', () => {
    expect(component.divergences()).toBe(1);
  });

  it('sem carimbo nenhum, não há divergência a apontar', () => {
    api.userGrid.and.returnValue(of({ ...GRADE, stamped: {} }));
    component.select(PESSOAS[0]);

    expect(component.divergences()).toBe(0);
  });
});
