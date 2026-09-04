import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from './auth.service';
import { MenuService } from './menu.service';

/** Uma tela que a pessoa já abriu, com quanto e quando. */
export interface TelaRecente {
  path: string;
  label: string;
  icon: string;
  breadcrumb: string;
  visitas: number;
  ultimoAcesso: number;
}

/** Quantas telas a lista de recentes mostra. */
const QUANTAS_RECENTES = 6;

/**
 * Teto do que fica guardado. Não é o que aparece na tela — é só para o registro
 * não crescer para sempre no `localStorage` de quem usa o app todo dia.
 */
const TETO_GUARDADO = 40;

/**
 * Registro das telas que a pessoa abre, para o menu do celular.
 *
 * **Por que não reusar o `TabsService`**, que já escuta as navegações: ele
 * ordena por *inserção*, não por uso — revisitar uma aba não a promove —, tem
 * teto de 8 abas de trabalho, e grava numa chave global sem id de usuário. As
 * três coisas estão certas para as abas do desktop e erradas para "mais usado".
 *
 * Aqui guardamos duas medidas diferentes de propósito:
 *
 * - **`recentes`** ordena por *quando* — é o que a pessoa acabou de fazer, e é
 *   o que ajuda a retomar o trabalho.
 * - **`maisUsada`** ordena por *quantas vezes* — é o hábito, e é o que merece
 *   um atalho fixo na barra de baixo. Confundir as duas daria uma barra que
 *   muda de item a cada navegação, que é pior que uma barra fixa.
 */
@Injectable({ providedIn: 'root' })
export class TelasRecentesService {

  private readonly router = inject(Router);
  private readonly menu = inject(MenuService);
  private readonly auth = inject(AuthService);

  private readonly registro = signal<TelaRecente[]>([]);

  /** As últimas telas abertas, da mais recente para a mais antiga. */
  readonly recentes = computed(() =>
    [...this.registro()]
      .sort((a, b) => b.ultimoAcesso - a.ultimoAcesso)
      .slice(0, QUANTAS_RECENTES));

  /**
   * As telas em ordem de hábito — mais visitadas primeiro. Empate de visitas
   * desempata pelo acesso mais recente.
   *
   * **É a lista inteira, e não só a primeira, de propósito.** A barra de baixo
   * precisa da mais usada *que ainda não esteja nela*: entregar só o topo
   * fazia a Início — onde o app abre, e por isso quase sempre a campeã de
   * visitas num celular — esconder o atalho que a barra existe para mostrar.
   */
  readonly porHabito = computed<TelaRecente[]>(() =>
    [...this.registro()]
      .sort((a, b) => b.visitas - a.visitas || b.ultimoAcesso - a.ultimoAcesso));

  constructor() {
    this.restaurar();

    this.router.events
      .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe(evento => this.registrar(evento.urlAfterRedirects));
  }

  /**
   * Anota uma visita. Telas fora do menu são ignoradas: sem entrada no
   * catálogo não há rótulo nem ícone, e um atalho escrito "123" não ajuda
   * ninguém.
   */
  registrar(url: string): void {
    const item = this.menu.findByUrl(url);
    if (!item?.path) return;

    const agora = Date.now();

    this.registro.update(atual => {
      const anterior = atual.find(tela => tela.path === item.path);

      const atualizado: TelaRecente = {
        path: item.path,
        label: item.label,
        icon: item.icon,
        breadcrumb: item.breadcrumb,
        visitas: (anterior?.visitas ?? 0) + 1,
        ultimoAcesso: agora,
      };

      return [atualizado, ...atual.filter(tela => tela.path !== item.path)]
        .sort((a, b) => b.ultimoAcesso - a.ultimoAcesso)
        .slice(0, TETO_GUARDADO);
    });

    this.guardar();
  }

  /** Esquece tudo — usado na saída, para o próximo usuário não herdar a lista. */
  limpar(): void {
    this.registro.set([]);
    this.comStorage(storage => storage.removeItem(this.chave()));
  }

  /**
   * A chave carrega o usuário. As outras chaves do app são globais, e no
   * escritório duas pessoas dividem o mesmo navegador — sem isso a segunda
   * abriria o app com os atalhos da primeira.
   */
  private chave(): string {
    return `telas-recentes:${this.auth.getUsername() ?? 'anonimo'}`;
  }

  private restaurar(): void {
    this.comStorage(storage => {
      const bruto = storage.getItem(this.chave());
      if (!bruto) return;

      const lido: unknown = JSON.parse(bruto);
      if (!Array.isArray(lido)) return;

      this.registro.set(lido.filter(item => this.ehTelaRecente(item)));
    });
  }

  private guardar(): void {
    this.comStorage(storage =>
      storage.setItem(this.chave(), JSON.stringify(this.registro())));
  }

  /**
   * Todo acesso a `localStorage` passa por aqui. Em aba anônima e com dados de
   * site bloqueados o próprio `localStorage` **estoura** ao ser lido — e um
   * atalho de conveniência não pode derrubar o app inteiro.
   */
  private comStorage(acao: (storage: Storage) => void): void {
    try {
      acao(localStorage);
    } catch {
      // Sem storage o recurso simplesmente não lembra nada. Segue funcionando.
    }
  }

  private ehTelaRecente(item: unknown): item is TelaRecente {
    const tela = item as Partial<TelaRecente> | null;
    return !!tela
      && typeof tela.path === 'string'
      && typeof tela.label === 'string'
      && typeof tela.visitas === 'number'
      && typeof tela.ultimoAcesso === 'number';
  }
}
