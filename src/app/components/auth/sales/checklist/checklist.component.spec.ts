import { ComponentFixture, TestBed } from '@angular/core/testing';
import { checklistValido } from '../../../../../testing/checklist-fixtures';
import { NO_CELULAR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';
import { ChecklistDb } from '../../../../infrastructure/offline/checklist-db';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { CHECKLIST_DB, ChecklistOfflineStore } from '../../../../infrastructure/state/checklist-offline.store';
import { ChecklistComponent } from './checklist.component';

/** A tela do vendedor: o que pede ação primeiro, e nada escondido sem internet. */
describe('ChecklistComponent', () => {
  let fixture: ComponentFixture<ChecklistComponent>;
  let el: HTMLElement;
  let store: ChecklistOfflineStore;
  let db: ChecklistDb;
  let nome: string;

  beforeEach(async () => {
    larguraDaJanela(NO_CELULAR);
    nome = 'teste-pagina-' + Math.random().toString(36).slice(2);
    db = new ChecklistDb(nome);
    TestBed.configureTestingModule({
      imports: [ChecklistComponent],
      providers: providersDeTeste([
        { provide: CHECKLIST_DB, useValue: db },
        { provide: AuthService, useValue: { getUsername: () => 'diego' } },
      ]),
    });
    store = TestBed.inject(ChecklistOfflineStore);
    // Sem internet: nada é pedido à API, e a tela vive do que está no aparelho.
    store.online.set(false);
    await db.gravarNaFila({ chave: ChecklistDb.chave('diego', 'f1'), login: 'diego', id: 'f1', etapa: 8, tentativas: 1, recusa: null,
      guardadoEm: '2026-09-30T10:42:00.000Z', envio: { revision: 1, content: checklistValido(), filledOffline: true, deviceStartedAt: null } });
    fixture = TestBed.createComponent(ChecklistComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges(false);
    await new Promise(r => setTimeout(r, 50));
    fixture.detectChanges(false);
  });

  afterEach(async () => {
    restaurarLargura();
    fixture.destroy();
    await new Promise(r => setTimeout(r, 50));
    store.ngOnDestroy();
    await db.fechar();
    indexedDB.deleteDatabase(nome);
  });

  it('sem internet: a faixa explica, e o que está na fila aparece como "aguardando internet"', () => {
    expect(el.textContent).toContain('Sem internet agora.');
    expect(el.textContent).toContain('Aguardando internet');
    expect(el.textContent).toContain('Mercado Central - Unid. 2');
    expect(el.textContent).toContain('Vai enviar');
    expect(el.textContent).withContext('sem internet, não oferece "Enviar agora"').not.toContain('Enviar agora');
  });

  it('"Novo checklist" abre o formulário na etapa 1', async () => {
    const novo = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Novo checklist'))!;
    expect(novo.getBoundingClientRect().height).withContext('o botão principal é grande').toBeGreaterThanOrEqual(56);
    novo.click();
    await new Promise(r => setTimeout(r, 50));
    fixture.detectChanges(false);
    expect(el.textContent).toContain('Etapa 1 de 8');
    expect(store.rascunhos().length).withContext('o rascunho já existe no aparelho').toBe(1);
  });
});
