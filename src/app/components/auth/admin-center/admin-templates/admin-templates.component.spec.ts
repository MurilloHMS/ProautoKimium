import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { AdminTemplatesComponent } from './admin-templates.component';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import {
  ReapplyPreview, ScreenRow, TemplateGrid, TemplateSummary, UserSummary,
} from '../../../../domain/models/permission-admin.model';
import {
  NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura,
} from '../../../../../testing/test-setup';

/**
 * A aba Modelos, e a mensagem que ele pediu clara em 2026-10-08: o que o Salvar
 * faz, o que o Reaplicar faz, e quem perde o quê antes do clique.
 */
describe('AdminTemplatesComponent', () => {
  let fixture: ComponentFixture<AdminTemplatesComponent>;
  let component: AdminTemplatesComponent;
  let api: jasmine.SpyObj<PermissionAdminService>;
  const el = () => fixture.nativeElement as HTMLElement;

  const TELAS: ScreenRow[] = [
    { code: 'stock/products', label: 'Produtos', module: 'Estoque', sortOrder: 10,
      actions: ['ALTERAR', 'EXCLUIR', 'INCLUIR'] },
  ];

  const MODELOS: TemplateSummary[] = [
    { id: 't-almox', name: 'ALMOXARIFADO', description: 'Estoque completo', active: true, allowedCells: 3, appliedToUsers: 3 },
  ];

  const GRADE: TemplateGrid = {
    id: 't-almox', name: 'ALMOXARIFADO', description: 'Estoque completo', active: true,
    cells: { 'stock/products': ['ALTERAR', 'EXCLUIR', 'INCLUIR'] },
  };

  const pessoa = (id: string, name: string): UserSummary =>
    ({ id, name, login: id, active: true, developer: false, templates: ['ALMOXARIFADO'] });

  const RECEBERAM = [pessoa('u-w', 'Weslley Andrade'), pessoa('u-c', 'Carlos Dias'), pessoa('u-j', 'Jéssica Reis')];

  const PREVIA: ReapplyPreview = {
    people: [
      { id: 'u-w', name: 'Weslley Andrade', loses: [], gains: ['stock/products:EXCLUIR'] },
      { id: 'u-c', name: 'Carlos Dias', loses: [], gains: [] },
      { id: 'u-j', name: 'Jéssica Reis', loses: ['stock/products:EXCLUIR'], gains: [] },
    ],
  };

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    api = jasmine.createSpyObj<PermissionAdminService>('PermissionAdminService', [
      'screens', 'templates', 'users', 'templateGrid', 'appliedTo', 'reapplyPreview', 'reapply',
      'apply', 'saveTemplateGrid', 'createTemplate', 'editTemplate',
    ]);
    api.screens.and.returnValue(of(TELAS));
    api.templates.and.returnValue(of(MODELOS));
    api.users.and.returnValue(of(RECEBERAM));
    api.templateGrid.and.returnValue(of(GRADE));
    api.appliedTo.and.returnValue(of(RECEBERAM));
    api.reapplyPreview.and.returnValue(of(PREVIA));
    api.reapply.and.returnValue(of({ users: 3, cellsChanged: 2 }));

    await TestBed.configureTestingModule({
      imports: [AdminTemplatesComponent],
      providers: providersDeTeste([
        MessageService,
        { provide: PermissionAdminService, useValue: api },
        { provide: PermissionStore, useValue: { can: () => true, canOpen: () => true } },
      ]),
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    component.reapplyOpen.set(false);
    fixture.detectChanges();
    restaurarLargura();
  });

  /** As três partes que ele aprovou: quem recebeu, o que o Salvar faz, o que o Reaplicar faz. */
  it('o aviso diz quem recebeu, que salvar não muda essas pessoas, e o que o Reaplicar faz', () => {
    const aviso = el().querySelector('.at__notice')!.textContent!.replace(/\s+/g, ' ');

    expect(aviso).toContain('3 pessoas já receberam este modelo: Weslley, Carlos e Jéssica.');
    expect(aviso).toContain('Salvar o modelo não muda o acesso delas.');
    expect(aviso).toContain('o que foi ajustado à mão nessas pessoas se perde');
    expect(aviso).withContext('nomeia quem muda, nas duas direções')
      .toContain('Hoje, reaplicar muda o acesso de Weslley Andrade (1 mudança), Jéssica Reis (1 mudança).');
  });

  it('a confirmação diz, por pessoa e por extenso, o que se perde e o que chega', () => {
    component.openReapply();
    fixture.detectChanges();

    const dialogo = document.body.querySelector('.at__preview')!.textContent!.replace(/\s+/g, ' ');
    expect(dialogo).toContain('Deixa de poder: Excluir em Produtos.');
    expect(dialogo).toContain('Passa a poder: Excluir em Produtos.');
    expect(dialogo).toContain('Nada muda');
  });

  /**
   * **O defeito que o botão tinha.** O Reaplicar antigo chamava o `apply` com
   * SUBSTITUIR e deixava a pessoa igual a ESTE modelo, apagando o Base. Agora é
   * o endpoint próprio, que refaz pela soma dos modelos de cada pessoa.
   */
  it('confirmar chama o reaplicar da API, e não o aplicar com SUBSTITUIR', () => {
    component.openReapply();
    component.confirmReapply();

    expect(api.reapply).toHaveBeenCalledWith('t-almox');
    expect(api.apply).not.toHaveBeenCalled();
  });

  it('com alteração não salva, o Reaplicar espera: reaplicaria a versão antiga', () => {
    component.changed.set(1);
    fixture.detectChanges();

    const botao = Array.from(el().querySelectorAll<HTMLButtonElement>('.at__notice button'))
      .find(b => b.textContent!.includes('Reaplicar'))!;
    expect(botao.disabled).toBeTrue();
  });
});
