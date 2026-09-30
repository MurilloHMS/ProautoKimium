import { checklistValido } from '../../../testing/checklist-fixtures';
import { ChecklistDb, Rascunho } from './checklist-db';

function rascunho(login: string, id: string): Rascunho {
  return {
    chave: ChecklistDb.chave(login, id), login, id, conteudo: checklistValido(), etapa: 3, revision: 1,
    iniciadoEm: '2026-09-30T08:00:00.000Z', salvoEm: '2026-09-30T08:05:00.000Z', semInternet: true,
  };
}

/** O que fica no celular sobrevive a fechar o app, e cada pessoa vê só o seu. */
describe('ChecklistDb', () => {
  let nome: string;
  let db: ChecklistDb;

  beforeEach(() => {
    nome = 'teste-checklist-' + Math.random().toString(36).slice(2);
    db = new ChecklistDb(nome);
  });

  afterEach(async () => {
    await db.fechar();
    indexedDB.deleteDatabase(nome);
  });

  it('o rascunho sobrevive a fechar e abrir de novo (recarregar a página)', async () => {
    await db.gravarRascunho(rascunho('diego', 'a'));
    await db.fechar();

    const reaberto = new ChecklistDb(nome);
    const lido = await reaberto.lerRascunho('diego', 'a');
    expect(lido?.conteudo.customer?.name).toBe('Mercado Central - Unid. 2');
    expect(lido?.etapa).toBe(3);
    expect(reaberto.persistente).toBeTrue();
    db = reaberto;
  });

  it('outra pessoa no mesmo celular não vê o rascunho', async () => {
    await db.gravarRascunho(rascunho('diego', 'a'));
    await db.gravarRascunho(rascunho('ana', 'b'));
    expect((await db.rascunhos('diego')).map(r => r.id)).toEqual(['a']);
    expect((await db.rascunhos('ana')).map(r => r.id)).toEqual(['b']);
    expect(await db.lerRascunho('ana', 'a')).toBeUndefined();
  });

  it('fila: grava, lista por login e tira', async () => {
    await db.gravarNaFila({ chave: ChecklistDb.chave('diego', 'x'), login: 'diego', id: 'x', etapa: 8, tentativas: 0, recusa: null,
      guardadoEm: '2026-09-30T09:00:00.000Z', envio: { revision: 1, content: checklistValido(), filledOffline: true, deviceStartedAt: null } });
    expect((await db.fila('diego')).length).toBe(1);
    await db.tirarDaFila('diego', 'x');
    expect(await db.fila('diego')).toEqual([]);
  });
});
