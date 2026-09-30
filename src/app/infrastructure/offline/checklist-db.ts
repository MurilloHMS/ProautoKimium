import { ChecklistCatalog, ChecklistContent, ChecklistSubmit, ChecklistSummary } from '../../domain/models/sales/checklist.model';

/**
 * Um checklist sendo preenchido. Salvo a cada mudança — fechar o app, acabar a
 * bateria ou perder o sinal no meio não perde nada.
 */
export interface Rascunho {
  chave: string;
  login: string;
  id: string;
  conteudo: ChecklistContent;
  /** A etapa em que parou, para reabrir no mesmo lugar. */
  etapa: number;
  /** A versão que o envio vai criar: 1 no novo; a atual + 1 quando é correção. */
  revision: number;
  iniciadoEm: string;
  salvoEm: string;
  /** Alguma parte foi preenchida sem internet (vai no checklist, para a Controladoria saber). */
  semInternet: boolean;
  /** Quando é correção de um já enviado: o que a Controladoria disse. */
  motivo?: string | null;
  numero?: number | null;
}

/** Um checklist pronto, esperando a internet para ir. */
export interface ItemDaFila {
  chave: string;
  login: string;
  id: string;
  envio: ChecklistSubmit;
  guardadoEm: string;
  tentativas: number;
  /** A última recusa do servidor (400, 409): não adianta tentar de novo sem corrigir. */
  recusa: string | null;
  etapa: number;
  numero?: number | null;
}

interface Catalogo {
  login: string;
  catalogo: ChecklistCatalog;
  etag: string | null;
  baixadoEm: string;
}

/** Os já enviados, para a lista abrir sem internet. */
interface Enviados {
  login: string;
  lista: ChecklistSummary[];
  atualizadoEm: string;
}

type Loja = 'catalogo' | 'rascunhos' | 'fila' | 'enviados';

/**
 * O que o checklist guarda no celular, no IndexedDB.
 *
 * <p>IndexedDB, e não localStorage: o catálogo tem 3 MB (o localStorage tem
 * 5 MB para o site inteiro), e o localStorage bloqueia a tela a cada gravação.
 *
 * <p>Sem biblioteca: são quatro lojas com chave simples, e o que uma lib
 * resolveria aqui é só transformar requisição em Promise.
 *
 * <p><b>Quando o navegador recusa</b> (aba anônima antiga, armazenamento
 * cheio), cai para a memória e {@link persistente} fica falso — a tela avisa
 * que fechar o app perde o rascunho, em vez de fingir que guardou.
 */
export class ChecklistDb {

  private db: Promise<IDBDatabase | null>;
  private readonly memoria = new Map<Loja, Map<string, unknown>>();
  persistente = true;

  constructor(private readonly nome = 'kimiumhub-checklist') {
    this.db = this.abrir();
  }

  private abrir(): Promise<IDBDatabase | null> {
    return new Promise(resolve => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('sem IndexedDB');
        const req = indexedDB.open(this.nome, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('catalogo', { keyPath: 'login' });
          db.createObjectStore('rascunhos', { keyPath: 'chave' });
          db.createObjectStore('fila', { keyPath: 'chave' });
          db.createObjectStore('enviados', { keyPath: 'login' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { this.persistente = false; resolve(null); };
        req.onblocked = () => { this.persistente = false; resolve(null); };
      } catch {
        this.persistente = false;
        resolve(null);
      }
    });
  }

  static chave(login: string, id: string): string {
    return `${login}|${id}`;
  }

  // ── Genérico ─────────────────────────────────────────────────────────────

  private async ler<T>(loja: Loja, chave: string): Promise<T | undefined> {
    const db = await this.db;
    if (!db) return this.mem(loja).get(chave) as T | undefined;
    return this.pedido<T>(db, loja, 'readonly', s => s.get(chave));
  }

  private async gravar<T>(loja: Loja, valor: T, chave: string): Promise<void> {
    const db = await this.db;
    if (!db) { this.mem(loja).set(chave, structuredClone(valor)); return; }
    await this.pedido(db, loja, 'readwrite', s => s.put(valor));
  }

  private async apagar(loja: Loja, chave: string): Promise<void> {
    const db = await this.db;
    if (!db) { this.mem(loja).delete(chave); return; }
    await this.pedido(db, loja, 'readwrite', s => s.delete(chave));
  }

  private async todos<T extends { login: string }>(loja: Loja, login: string): Promise<T[]> {
    const db = await this.db;
    const lista = db
      ? await this.pedido<T[]>(db, loja, 'readonly', s => s.getAll())
      : [...this.mem(loja).values()] as T[];
    return (lista ?? []).filter(x => x.login === login);
  }

  private pedido<T>(db: IDBDatabase, loja: Loja, modo: IDBTransactionMode, fazer: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(loja, modo);
        const req = fazer(tx.objectStore(loja));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  private mem(loja: Loja): Map<string, unknown> {
    let m = this.memoria.get(loja);
    if (!m) this.memoria.set(loja, m = new Map());
    return m;
  }

  // ── Catálogo ─────────────────────────────────────────────────────────────

  lerCatalogo(login: string): Promise<Catalogo | undefined> {
    return this.ler<Catalogo>('catalogo', login);
  }

  gravarCatalogo(login: string, catalogo: ChecklistCatalog, etag: string | null, agora: Date): Promise<void> {
    return this.gravar('catalogo', { login, catalogo, etag, baixadoEm: agora.toISOString() }, login);
  }

  // ── Rascunhos ────────────────────────────────────────────────────────────

  rascunhos(login: string): Promise<Rascunho[]> {
    return this.todos<Rascunho>('rascunhos', login);
  }

  lerRascunho(login: string, id: string): Promise<Rascunho | undefined> {
    return this.ler<Rascunho>('rascunhos', ChecklistDb.chave(login, id));
  }

  gravarRascunho(r: Rascunho): Promise<void> {
    return this.gravar('rascunhos', r, r.chave);
  }

  apagarRascunho(login: string, id: string): Promise<void> {
    return this.apagar('rascunhos', ChecklistDb.chave(login, id));
  }

  // ── Fila ─────────────────────────────────────────────────────────────────

  fila(login: string): Promise<ItemDaFila[]> {
    return this.todos<ItemDaFila>('fila', login);
  }

  gravarNaFila(item: ItemDaFila): Promise<void> {
    return this.gravar('fila', item, item.chave);
  }

  tirarDaFila(login: string, id: string): Promise<void> {
    return this.apagar('fila', ChecklistDb.chave(login, id));
  }

  // ── Enviados ─────────────────────────────────────────────────────────────

  async enviados(login: string): Promise<ChecklistSummary[]> {
    return (await this.ler<Enviados>('enviados', login))?.lista ?? [];
  }

  gravarEnviados(login: string, lista: ChecklistSummary[], agora: Date): Promise<void> {
    return this.gravar('enviados', { login, lista, atualizadoEm: agora.toISOString() }, login);
  }

  /** Fecha a conexão — os testes apagam o banco depois. */
  async fechar(): Promise<void> {
    (await this.db)?.close();
  }
}
