import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { catalogoDeTeste, checklistValido } from '../../../testing/checklist-fixtures';
import { providersDeTeste } from '../../../testing/test-setup';
import { ChecklistDetail } from '../../domain/models/sales/checklist.model';
import { ChecklistDb } from '../offline/checklist-db';
import { AuthService } from '../services/auth.service';
import { CHECKLIST_DB, ChecklistOfflineStore, novoId } from './checklist-offline.store';

const API = `${environment.apiUrl}/checklists`;

function detalhe(id: string, version = 1): ChecklistDetail {
  return {
    summary: { id, number: 142, sellerLogin: 'diego', sellerName: 'Diego', customerCode: 3661, customerName: 'Mercado Central - Unid. 2',
      customerDocument: '11222333000181', newCustomer: false, status: 'SUBMITTED', version, hasOrder: true, orderTotal: 1209.86,
      filledOffline: true, firstSubmittedAt: '2026-09-30T10:00:00', lastSubmittedAt: '2026-09-30T10:00:00', reviewNotes: null,
      reviewedAt: null, changeReason: null, changeRequestedAt: null },
    content: checklistValido(), events: [], changes: [], erpDifferences: [],
  };
}

/**
 * A fila do celular. O que se protege: sem sinal nada se perde e nada é
 * refeito; o reenvio é o MESMO envio (mesmo id, mesma versão); recusa do
 * servidor volta para o vendedor corrigir, com a frase da API.
 */
describe('ChecklistOfflineStore', () => {
  let store: ChecklistOfflineStore;
  let http: HttpTestingController;
  let db: ChecklistDb;
  let nome: string;
  let login = 'diego';

  beforeEach(() => {
    nome = 'teste-store-' + Math.random().toString(36).slice(2);
    db = new ChecklistDb(nome);
    login = 'diego';
    TestBed.configureTestingModule({
      providers: providersDeTeste([
        { provide: CHECKLIST_DB, useValue: db },
        { provide: AuthService, useValue: { getUsername: () => login } },
      ]),
    });
    store = TestBed.inject(ChecklistOfflineStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    store.ngOnDestroy();
    await db.fechar();
    indexedDB.deleteDatabase(nome);
  });

  /** Espera a fila chegar ao pedido HTTP (as gravações no IndexedDB vêm antes). */
  async function pedido(url: string) {
    for (let i = 0; i < 50; i++) {
      const achados = http.match(r => r.url === url);
      if (achados.length) return achados[0];
      await new Promise(r => setTimeout(r, 10));
    }
    throw new Error('nenhum pedido para ' + url);
  }

  async function rascunhoPronto() {
    const r = await store.novoRascunho();
    const pronto = { ...r, conteudo: checklistValido(), etapa: 8 };
    await store.salvarRascunho(pronto);
    return pronto;
  }

  it('com internet: envia, tira da fila e aparece nos enviados', async () => {
    const r = await rascunhoPronto();
    const envio = store.enviar(r);

    const req = await pedido(`${API}/${r.id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.revision).toBe(1);
    req.flush(detalhe(r.id));

    expect(await envio).withContext('foi agora').toEqual({ tipo: 'enviado' });
    expect(store.fila()).toEqual([]);
    expect(store.rascunhos()).toEqual([]);
    expect(store.enviados()[0].id).toBe(r.id);
    expect(await db.fila('diego')).toEqual([]);
    // Enviou: a lista do servidor é pedida uma vez (e só uma).
    (await pedido(`${API}/me`)).flush([detalhe(r.id).summary]);
    expect(http.match(req => req.url === `${API}/me`).length).toBe(0);
  });

  it('sem sinal: fica na fila (e no aparelho); quando a internet volta, reenvia o MESMO envio', async () => {
    const r = await rascunhoPronto();
    const envio = store.enviar(r);
    (await pedido(`${API}/${r.id}`)).error(new ProgressEvent('error'), { status: 0 });

    expect(await envio).withContext('guardado, não enviado').toEqual({ tipo: 'aguardando' });
    expect(store.aguardando().map(f => f.id)).toEqual([r.id]);
    expect((await db.fila('diego')).length).withContext('está no aparelho').toBe(1);

    window.dispatchEvent(new Event('online'));
    const reenvio = await pedido(`${API}/${r.id}`);
    expect(reenvio.request.body.revision).toBe(1);
    expect(reenvio.request.body.content.customer.document).toBe('11222333000181');
    reenvio.flush(detalhe(r.id));
    await new Promise(res => setTimeout(res, 20));
    expect(store.fila()).toEqual([]);
  });

  it('recusa do servidor (400) não é repetida: vira aviso, e volta para corrigir com a frase', async () => {
    const r = await rascunhoPronto();
    const envio = store.enviar(r);
    (await pedido(`${API}/${r.id}`)).flush({ message: 'Etapa 3 — o CPF de quem assina é inválido.' }, { status: 400, statusText: 'Bad Request' });
    expect(await envio).withContext('recusado não é "enviado"').toEqual({ tipo: 'recusado', motivo: 'Etapa 3 — o CPF de quem assina é inválido.' });

    expect(store.recusados().map(f => f.recusa)).toEqual(['Etapa 3 — o CPF de quem assina é inválido.']);
    expect(store.aguardando()).toEqual([]);

    const corrigir = await store.corrigirRecusado(store.recusados()[0]);
    expect(corrigir.motivo).toBe('Etapa 3 — o CPF de quem assina é inválido.');
    expect(store.fila()).toEqual([]);
    expect(store.rascunhos().map(x => x.id)).toEqual([r.id]);
  });

  it('sessão vencida (401) espera e tenta de novo; não manda "corrigir"', async () => {
    const r = await rascunhoPronto();
    const envio = store.enviar(r);
    (await pedido(`${API}/${r.id}`)).flush({}, { status: 401, statusText: 'Unauthorized' });
    await envio;
    expect(store.recusados()).toEqual([]);
    expect(store.aguardando().length).toBe(1);
  });

  it('outra pessoa que entra no mesmo celular não vê nem envia o que não é dela', async () => {
    await rascunhoPronto();
    login = 'ana';
    const iniciando = store.iniciar();
    (await pedido(`${API}/me`)).flush([]);
    (await pedido(`${API}/catalog`)).flush(catalogoDeTeste());
    await iniciando;
    expect(store.rascunhos()).toEqual([]);
    expect(store.fila()).toEqual([]);
  });

  it('catálogo: guarda com o ETag e pergunta "mudou?" da próxima vez; 304 mantém o que tem', async () => {
    const primeira = store.atualizarCatalogo();
    (await pedido(`${API}/catalog`)).flush(catalogoDeTeste(), { headers: { ETag: 'W/"v1"' } });
    await primeira;
    expect(store.indice()?.clientes.length).toBe(2);

    const segunda = store.atualizarCatalogo();
    const req = await pedido(`${API}/catalog`);
    expect(req.request.headers.get('If-None-Match')).toBe('W/"v1"');
    req.flush(null, { status: 304, statusText: 'Not Modified' });
    await segunda;
    expect(store.indice()?.clientes.length).withContext('continua o guardado').toBe(2);
    expect(store.erroCatalogo()).toBeNull();
  });

  it('o id nasce no aparelho, no formato UUID', () => {
    expect(novoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  /** O que o aviso de saída conta (pedido dele, 2026-09-30). */
  it('pendências: fila esperando e recusada, rascunho preenchido; rascunho em branco e outro login não contam', async () => {
    const item = (id: string, recusa: string | null, dono = 'diego') => ({
      chave: ChecklistDb.chave(dono, id), login: dono, id, guardadoEm: new Date().toISOString(), tentativas: 0, recusa, etapa: 8,
      envio: { revision: 1, content: checklistValido(), filledOffline: true, deviceStartedAt: null },
    });
    await db.gravarNaFila(item('f1', null));
    await db.gravarNaFila(item('f2', 'O CPF de quem assina é inválido.'));
    await db.gravarNaFila(item('f3', null, 'outra-pessoa'));
    await store.salvarRascunho(await store.novoRascunho());   // aberto e largado em branco
    await rascunhoPronto();

    expect(await store.pendingItems()).toEqual({ waiting: 1, refused: 1, drafts: 1 });
  });

  it('pendências: sem login, ou com o banco do aparelho quebrado, conta zero — nunca impede a saída', async () => {
    login = null as unknown as string;
    expect(await store.pendingItems()).toEqual({ waiting: 0, refused: 0, drafts: 0 });
    login = 'diego';
    spyOn(db, 'fila').and.rejectWith(new Error('IndexedDB bloqueado'));
    expect(await store.pendingItems()).toEqual({ waiting: 0, refused: 0, drafts: 0 });
  });
});
