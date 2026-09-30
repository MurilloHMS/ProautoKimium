import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, OnDestroy, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChecklistDetail, ChecklistSummary, editavel,
} from '../../domain/models/sales/checklist.model';
import { apiMessage } from '../../domain/utils/api-error';
import { CatalogoIndexado, indexar } from '../../domain/utils/checklist/checklist-catalogo';
import { checklistVazio } from '../../domain/utils/checklist/checklist-regras';
import { ChecklistDb, ItemDaFila, Rascunho } from '../offline/checklist-db';
import { AuthService } from '../services/auth.service';
import { ChecklistApiService } from '../services/sales/checklist-api.service';

/** O banco do aparelho. Token para o teste trocar por um banco de nome próprio. */
export const CHECKLIST_DB = new InjectionToken<ChecklistDb>('CHECKLIST_DB', {
  providedIn: 'root',
  factory: () => new ChecklistDb(),
});

export type DesfechoDoEnvio =
  | { tipo: 'enviado' }
  | { tipo: 'aguardando' }
  | { tipo: 'recusado'; motivo: string };

/** O que ainda não chegou à Controladoria, neste aparelho e com este login. */
export interface PendingChecklists {
  /** Na fila, esperando sinal. */
  waiting: number;
  /** Na fila, recusados pela API: precisam de correção. */
  refused: number;
  /** Em preenchimento, nunca enviados. Rascunho aberto e deixado em branco não conta. */
  drafts: number;
}

/** Espera entre tentativas de envio sem sinal: 5 s, 15 s, 30 s, 1 min, 2 min, e fica em 5 min. */
export const ESPERAS_DE_REENVIO = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

/**
 * O checklist no celular: catálogo, rascunhos e a fila de envio.
 *
 * <p><b>A regra:</b> nada do que o vendedor digitou depende da rede. O
 * rascunho vai para o aparelho a cada mudança; "Enviar" põe na fila; a fila
 * sai sozinha quando a internet volta — no evento `online`, ao reabrir o app
 * e ao voltar para a aba. Não usa Background Sync, que o iPhone não tem.
 *
 * <p><b>Duas falhas, dois destinos.</b> Sem sinal (status 0, 5xx, tempo
 * esgotado), o item espera e tenta de novo, sozinho. Recusa do servidor (400,
 * 404, 409) não melhora tentando: vira aviso com a frase da API, e o vendedor
 * abre para corrigir.
 *
 * <p><b>Repetir não duplica:</b> o id nasce aqui e o envio é PUT. Se a resposta
 * se perdeu no caminho, o próximo envio do mesmo item cai no mesmo registro.
 */
@Injectable({ providedIn: 'root' })
export class ChecklistOfflineStore implements OnDestroy {

  private readonly api = inject(ChecklistApiService);
  private readonly auth = inject(AuthService);
  private readonly db = inject(CHECKLIST_DB);

  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly persistente = signal(true);

  readonly indice = signal<CatalogoIndexado | null>(null);
  readonly catalogoBaixadoEm = signal<string | null>(null);
  readonly baixandoCatalogo = signal(false);
  readonly erroCatalogo = signal<string | null>(null);

  readonly rascunhos = signal<Rascunho[]>([]);
  readonly fila = signal<ItemDaFila[]>([]);
  readonly enviados = signal<ChecklistSummary[]>([]);
  readonly enviando = signal(false);

  /** Os que ainda não foram, e não por recusa: é o "aguardando internet". */
  readonly aguardando = computed(() => this.fila().filter(i => !i.recusa));
  readonly recusados = computed(() => this.fila().filter(i => !!i.recusa));

  private iniciado: string | null = null;
  private tentativa = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ouvindo = false;

  constructor() {
    // Ouve a volta do sinal desde que nasce, e não só depois de iniciar():
    // um item que caiu na fila não pode ficar surdo ao evento `online`.
    this.ouvir();
  }

  private login(): string | null {
    return this.auth.getUsername();
  }

  /**
   * Carrega o que está no aparelho e tenta sincronizar. Chamado ao abrir a
   * tela e pelo layout ao entrar no sistema — a fila sai mesmo que o vendedor
   * abra outra tela primeiro.
   */
  async iniciar(): Promise<void> {
    const login = this.login();
    if (!login) return;
    if (this.iniciado !== login) {
      this.iniciado = login;
      await this.carregarDoAparelho(login);
    }
    await this.sincronizar();
  }

  private async carregarDoAparelho(login: string): Promise<void> {
    const [catalogo, rascunhos, fila, enviados] = await Promise.all([
      this.db.lerCatalogo(login), this.db.rascunhos(login), this.db.fila(login), this.db.enviados(login),
    ]);
    this.persistente.set(this.db.persistente);
    this.indice.set(catalogo ? indexar(catalogo.catalogo) : null);
    this.catalogoBaixadoEm.set(catalogo?.baixadoEm ?? null);
    this.rascunhos.set(ordenar(rascunhos, r => r.salvoEm));
    this.fila.set(ordenar(fila, f => f.guardadoEm));
    this.enviados.set(enviados);
  }

  private readonly aoVoltarSinal = () => { this.online.set(true); this.tentativa = 0; void this.sincronizar(); };
  private readonly aoPerderSinal = () => this.online.set(false);
  private readonly aoVoltarParaAba = () => { if (document.visibilityState === 'visible') void this.sincronizar(); };

  private ouvir(): void {
    if (this.ouvindo || typeof window === 'undefined') return;
    this.ouvindo = true;
    window.addEventListener('online', this.aoVoltarSinal);
    window.addEventListener('offline', this.aoPerderSinal);
    document.addEventListener('visibilitychange', this.aoVoltarParaAba);
  }

  /** Solta os ouvintes e o timer — no app ele vive a sessão toda; nos testes, um por caso. */
  ngOnDestroy(): void {
    this.cancelarTimer();
    if (!this.ouvindo) return;
    window.removeEventListener('online', this.aoVoltarSinal);
    window.removeEventListener('offline', this.aoPerderSinal);
    document.removeEventListener('visibilitychange', this.aoVoltarParaAba);
    this.ouvindo = false;
  }

  async sincronizar(): Promise<void> {
    if (!this.online()) return;
    await this.enviarFila();
    await Promise.all([this.atualizarCatalogo(), this.atualizarEnviados()]);
  }

  // ── Catálogo ─────────────────────────────────────────────────────────────

  async atualizarCatalogo(): Promise<void> {
    const login = this.login();
    if (!login || this.baixandoCatalogo()) return;
    this.baixandoCatalogo.set(true);
    this.erroCatalogo.set(null);
    try {
      const guardado = await this.db.lerCatalogo(login);
      const resp = await firstValueFrom(this.api.catalogo(guardado?.etag ?? null));
      if (resp.body) {
        const agora = new Date();
        await this.db.gravarCatalogo(login, resp.body, resp.headers.get('ETag'), agora);
        this.indice.set(indexar(resp.body));
        this.catalogoBaixadoEm.set(agora.toISOString());
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 304) {
        // Nada mudou desde a última vez: o que está no aparelho vale.
      } else if (semSinal(err)) {
        this.online.set(typeof navigator === 'undefined' ? false : navigator.onLine);
      } else {
        this.erroCatalogo.set(apiMessage(err as HttpErrorResponse) ?? 'Não foi possível atualizar a lista de clientes e produtos.');
      }
    } finally {
      this.baixandoCatalogo.set(false);
    }
  }

  private async atualizarEnviados(): Promise<void> {
    const login = this.login();
    if (!login) return;
    try {
      const lista = await firstValueFrom(this.api.meus());
      await this.db.gravarEnviados(login, lista, new Date());
      this.enviados.set(lista);
    } catch {
      // Sem sinal, a lista guardada continua valendo.
    }
  }

  /**
   * Lido do banco do aparelho, e não dos signals: quem sai pode nunca ter
   * aberto a tela, e o store só carrega em iniciar(). Se o banco falhar, conta
   * zero — o aviso de saída não pode impedir ninguém de sair.
   */
  async pendingItems(): Promise<PendingChecklists> {
    const none = { waiting: 0, refused: 0, drafts: 0 };
    const login = this.login();
    if (!login) return none;
    try {
      const [queue, drafts] = await Promise.all([this.db.fila(login), this.db.rascunhos(login)]);
      const blank = JSON.stringify(checklistVazio());
      return {
        waiting: queue.filter(i => !i.recusa).length,
        refused: queue.filter(i => !!i.recusa).length,
        drafts: drafts.filter(r => JSON.stringify(r.conteudo) !== blank).length,
      };
    } catch {
      return none;
    }
  }

  // ── Rascunhos ────────────────────────────────────────────────────────────

  async novoRascunho(): Promise<Rascunho> {
    const login = this.login()!;
    const id = novoId();
    const agora = new Date().toISOString();
    const r: Rascunho = {
      chave: ChecklistDb.chave(login, id), login, id, conteudo: checklistVazio(), etapa: 1, revision: 1,
      iniciadoEm: agora, salvoEm: agora, semInternet: !this.online(),
    };
    await this.salvarRascunho(r);
    return r;
  }

  /** Correção de um enviado que a Controladoria devolveu ou liberou: nasce do conteúdo do servidor. */
  async corrigirEnviado(detalhe: ChecklistDetail): Promise<Rascunho> {
    if (!editavel(detalhe.summary.status)) {
      throw new Error('Este checklist não está liberado para alterar.');
    }
    const login = this.login()!;
    const existente = await this.db.lerRascunho(login, detalhe.summary.id);
    if (existente) return existente;
    const agora = new Date().toISOString();
    const r: Rascunho = {
      chave: ChecklistDb.chave(login, detalhe.summary.id), login, id: detalhe.summary.id,
      conteudo: structuredClone(detalhe.content), etapa: 1, revision: detalhe.summary.version + 1,
      iniciadoEm: agora, salvoEm: agora, semInternet: false,
      motivo: detalhe.summary.reviewNotes, numero: detalhe.summary.number,
    };
    await this.salvarRascunho(r);
    return r;
  }

  async salvarRascunho(r: Rascunho): Promise<void> {
    const salvo: Rascunho = { ...r, salvoEm: new Date().toISOString(), semInternet: r.semInternet || !this.online() };
    await this.db.gravarRascunho(salvo);
    this.rascunhos.update(lista => ordenar([salvo, ...lista.filter(x => x.id !== salvo.id)], x => x.salvoEm));
  }

  async descartarRascunho(id: string): Promise<void> {
    await this.db.apagarRascunho(this.login()!, id);
    this.rascunhos.update(lista => lista.filter(r => r.id !== id));
  }

  // ── Envio ────────────────────────────────────────────────────────────────

  /**
   * "Enviar": o rascunho vira item da fila, e a fila sai já, se houver sinal.
   *
   * Três desfechos, e a tela precisa dos três: foi (`enviado`), espera a
   * internet (`aguardando`), ou o servidor recusou (`recusado`, com a frase).
   * Com só "foi / não foi", a recusa aparecia como "enviado" e o checklist
   * voltava para a lista de rascunhos sem ninguém entender por quê (visto por
   * ele em 2026-09-30).
   */
  async enviar(r: Rascunho): Promise<DesfechoDoEnvio> {
    const item: ItemDaFila = {
      chave: r.chave, login: r.login, id: r.id, etapa: r.etapa, numero: r.numero ?? null,
      envio: { revision: r.revision, content: r.conteudo, filledOffline: r.semInternet, deviceStartedAt: semFuso(r.iniciadoEm) },
      guardadoEm: new Date().toISOString(), tentativas: 0, recusa: null,
    };
    await this.db.gravarNaFila(item);
    await this.db.apagarRascunho(r.login, r.id);
    this.rascunhos.update(lista => lista.filter(x => x.id !== r.id));
    this.fila.update(lista => [...lista.filter(x => x.id !== item.id), item]);
    this.tentativa = 0;
    await this.enviarFila();
    const naFila = this.fila().find(x => x.id === item.id);
    if (!naFila) return { tipo: 'enviado' };
    return naFila.recusa ? { tipo: 'recusado', motivo: naFila.recusa } : { tipo: 'aguardando' };
  }

  async enviarFila(): Promise<void> {
    if (this.enviando() || !this.online()) return;
    const login = this.login();
    if (!login) return;
    this.enviando.set(true);
    this.cancelarTimer();
    let semSinalAgora = false;
    let enviouAlgum = false;
    try {
      for (const item of this.fila().filter(i => !i.recusa)) {
        try {
          const detalhe = await firstValueFrom(this.api.enviar(item.id, item.envio));
          await this.db.tirarDaFila(login, item.id);
          this.fila.update(lista => lista.filter(x => x.id !== item.id));
          this.enviados.update(lista => [detalhe.summary, ...lista.filter(s => s.id !== detalhe.summary.id)]);
          this.tentativa = 0;
          enviouAlgum = true;
        } catch (err) {
          if (semSinal(err)) {
            semSinalAgora = true;
            await this.registrarTentativa(item, null);
            break;
          }
          await this.registrarTentativa(item, apiMessage(err as HttpErrorResponse)
            ?? 'O servidor recusou este checklist. Abra e confira.');
        }
      }
    } finally {
      this.enviando.set(false);
    }
    if (semSinalAgora) this.agendarReenvio();
    // Só quando algo saiu: com a fila vazia, quem atualiza a lista é o sincronizar().
    else if (enviouAlgum) void this.atualizarEnviados();
  }

  private async registrarTentativa(item: ItemDaFila, recusa: string | null): Promise<void> {
    const atualizado: ItemDaFila = { ...item, tentativas: item.tentativas + 1, recusa };
    await this.db.gravarNaFila(atualizado);
    this.fila.update(lista => lista.map(x => (x.id === item.id ? atualizado : x)));
  }

  /** O servidor recusou: volta para rascunho, com a frase da recusa, para o vendedor corrigir. */
  async corrigirRecusado(item: ItemDaFila): Promise<Rascunho> {
    const agora = new Date().toISOString();
    const r: Rascunho = {
      chave: item.chave, login: item.login, id: item.id, conteudo: item.envio.content, etapa: item.etapa,
      revision: item.envio.revision, iniciadoEm: item.envio.deviceStartedAt ?? agora, salvoEm: agora,
      semInternet: item.envio.filledOffline, motivo: item.recusa, numero: item.numero ?? null,
    };
    await this.db.gravarRascunho(r);
    await this.db.tirarDaFila(item.login, item.id);
    this.fila.update(lista => lista.filter(x => x.id !== item.id));
    this.rascunhos.update(lista => ordenar([r, ...lista.filter(x => x.id !== r.id)], x => x.salvoEm));
    return r;
  }

  private agendarReenvio(): void {
    this.cancelarTimer();
    const espera = ESPERAS_DE_REENVIO[Math.min(this.tentativa, ESPERAS_DE_REENVIO.length - 1)];
    this.tentativa++;
    this.timer = setTimeout(() => void this.enviarFila(), espera);
  }

  private cancelarTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Os testes param o relógio entre um caso e outro. */
  parar(): void {
    this.cancelarTimer();
  }
}

/**
 * Falta de sinal, e não recusa: status 0 (sem rede), 5xx (servidor ou proxy
 * fora), 408/429 — e 401, a sessão vencida: o checklist está certo, falta
 * entrar de novo. Tentar depois resolve; mandar o vendedor "corrigir" não.
 */
export function semSinal(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse)) return true;
  return err.status === 0 || err.status >= 500 || err.status === 401 || err.status === 408 || err.status === 429;
}

function ordenar<T>(lista: T[], data: (x: T) => string): T[] {
  return [...lista].sort((a, b) => data(b).localeCompare(data(a)));
}

/** A API recebe LocalDateTime: sem o "Z" e sem milissegundos. */
function semFuso(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * UUID v4. `crypto.randomUUID` só existe em contexto seguro (https ou
 * localhost); pelo IP da rede, testando no celular, ele não existe — e o
 * checklist não pode deixar de nascer por isso.
 */
export function novoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
