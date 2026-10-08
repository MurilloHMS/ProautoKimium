import { Component, computed, effect, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';

import {
  PERMISSION_LABELS, PermissionCells, PermissionName, ScreenRow,
} from '../../../../domain/models/permission-admin.model';

/** Um botão de ação desenhado. */
export interface GridAction {
  permission: PermissionName;
  label: string;
  key: string;
  on: boolean;
  /** Difere do que os modelos aplicados dão: o ponto laranja. */
  diverges: boolean;
}

export interface GridScreen {
  screen: ScreenRow;
  actions: GridAction[];
}

export interface GridModule {
  module: string;
  open: boolean;
  /** Telas com pelo menos uma ação liberada. */
  allowed: number;
  total: number;
  screens: GridScreen[];
}

const key = (screen: string, permission: string) => `${screen}:${permission}`;

/**
 * A ordem em que as ações aparecem na tela: a de quem lê uma tela — ver,
 * incluir, alterar, excluir — e depois as raras. A API manda na ordem do enum
 * (Alterar, Excluir, Consultar…), que deixava o "Ver" no meio da linha.
 */
const ORDEM: PermissionName[] = ['CONSULTAR', 'INCLUIR', 'ALTERAR', 'EXCLUIR', 'BAIXAR', 'ENVIAR', 'CONFIGURAR'];

function keysOf(cells: PermissionCells): Set<string> {
  const chaves = new Set<string>();
  for (const [tela, permissoes] of Object.entries(cells ?? {})) {
    for (const permissao of permissoes ?? []) chaves.add(key(tela, permissao));
  }
  return chaves;
}

/**
 * O que uma pessoa (ou um modelo) pode, tela por tela — usado nas duas abas da
 * administração.
 *
 * Era uma tabela de 72 telas por 7 colunas: 504 caixinhas, e a API conferia
 * cerca de um terço. Marcar "Excluir" no Hub de máquinas não fazia nada, e a
 * tela não tinha como dizer isso. Agora:
 *
 * 1. **Cada tela mostra só as ações que usa** (`screen.actions`, lidas dos
 *    `@PreAuthorize` pela API). Sem colunas, nada rola para o lado no celular.
 * 2. **Módulo é uma sanfona com placar.** Dá para achar o bloco certo sem
 *    abri-lo. Começa tudo fechado; a busca abre o que encontrar.
 * 3. **O alcance de toda ação em massa é o que está visível.** Filtrou por
 *    Estoque, o "liberar tudo" do módulo mexe só no que passou pelo filtro.
 * 4. **O que a tela não mostra viaja intacto.** Uma célula que a grade escondeu
 *    — ação que a tela não usa, ou tela que saiu do catálogo — volta no
 *    `current()` como veio. Esconder não pode virar apagar.
 *
 * O componente **não grava**: mantém a edição e diz quantas células mudaram.
 * Quem chama decide o que fazer com isso.
 */
@Component({
  selector: 'app-permission-grid',
  standalone: true,
  imports: [FormsModule, PkInputComponent],
  templateUrl: './permission-grid.component.html',
  styleUrl: './permission-grid.component.scss',
})
export class PermissionGridComponent {

  readonly screens = input<ScreenRow[]>([]);

  /** O que está gravado. Trocar de modelo ou de pessoa reinicia a edição. */
  readonly saved = input<PermissionCells>({});

  /** O que os modelos aplicados dão. Vazio na aba de modelos. */
  readonly applied = input<PermissionCells>({});

  /** Sem permissão de alterar, a grade é só leitura. */
  readonly disabled = input<boolean>(false);

  /** Quantas células diferem do gravado. A barra de salvar vive disto. */
  readonly changedCount = output<number>();

  readonly filter = signal('');
  readonly module = signal('todos');
  readonly opened = signal<ReadonlySet<string>>(new Set());

  /**
   * A edição em andamento.
   *
   * `linkedSignal` e não `signal` + `effect`: quando o pai troca a pessoa
   * aberta, a edição precisa reiniciar sozinha. Com `effect` isso seria
   * escrita de sinal dentro de efeito para manter dois estados em sincronia.
   */
  private readonly working = linkedSignal<PermissionCells, Set<string>>({
    source: this.saved,
    computation: cells => keysOf(cells),
  });

  private readonly savedKeys = computed(() => keysOf(this.saved()));
  private readonly appliedKeys = computed(() => keysOf(this.applied()));

  readonly changed = computed(() => {
    const agora = this.working();
    const antes = this.savedKeys();
    let total = 0;
    for (const chave of agora) if (!antes.has(chave)) total++;
    for (const chave of antes) if (!agora.has(chave)) total++;
    return total;
  });

  readonly modules = computed(() =>
    [...new Set(this.screens().map(s => s.module))]);

  /** As telas que passam pelo filtro — e o alcance de toda ação em massa. */
  readonly visible = computed(() => {
    const termo = this.filter().trim().toLowerCase();
    const modulo = this.module();

    return this.screens().filter(s =>
      (modulo === 'todos' || s.module === modulo) &&
      (!termo || s.label.toLowerCase().includes(termo) || s.code.includes(termo)));
  });

  readonly groups = computed<GridModule[]>(() => {
    const ligadas = this.working();
    const peloModelo = this.appliedKeys();
    const abertos = this.opened();
    // Buscando, abre o que achou: esconder o resultado atrás de um clique faria
    // a busca parecer vazia.
    const buscando = this.filter().trim().length > 0;

    const porModulo = new Map<string, GridScreen[]>();
    for (const screen of this.visible()) {
      const actions = this.actionsOf(screen).map(permission => {
        const chave = key(screen.code, permission);
        const on = ligadas.has(chave);
        return {
          permission,
          label: PERMISSION_LABELS[permission],
          key: chave,
          on,
          // Sem modelo aplicado não há o que divergir: é a aba de modelos.
          diverges: peloModelo.size > 0 && on !== peloModelo.has(chave),
        } satisfies GridAction;
      });
      const lista = porModulo.get(screen.module) ?? [];
      lista.push({ screen, actions });
      porModulo.set(screen.module, lista);
    }

    return [...porModulo.entries()].map(([module, screens]) => ({
      module,
      open: buscando || abertos.has(module),
      allowed: screens.filter(s => s.actions.some(a => a.on)).length,
      total: screens.length,
      screens,
    }));
  });

  constructor() {
    effect(() => this.changedCount.emit(this.changed()));
  }

  // ─── O que o pai chama ─────────────────────────────────────────────────────

  /** A grade como a API a espera: só o que está ligado — inclusive o escondido. */
  current(): PermissionCells {
    const cells: PermissionCells = {};
    for (const chave of [...this.working()].sort()) {
      const corte = chave.lastIndexOf(':');
      const tela = chave.slice(0, corte);
      (cells[tela] ??= []).push(chave.slice(corte + 1));
    }
    return cells;
  }

  /** Volta ao que está gravado. */
  discard(): void {
    this.working.set(keysOf(this.saved()));
  }

  // ─── Edição ────────────────────────────────────────────────────────────────

  toggle(chave: string): void {
    if (this.disabled()) return;
    this.write(atual => {
      atual.has(chave) ? atual.delete(chave) : atual.add(chave);
    });
  }

  /**
   * Liga ou desliga todas as ações das telas visíveis de um módulo.
   *
   * Só as ações que cada tela usa: ligar "Excluir" numa tela que não exclui
   * nada criaria uma célula que a grade não mostra e ninguém consegue tirar.
   */
  setModule(module: string, ligar: boolean): void {
    if (this.disabled()) return;
    this.write(atual => {
      for (const screen of this.visible().filter(s => s.module === module)) {
        for (const permission of this.actionsOf(screen)) {
          const chave = key(screen.code, permission);
          ligar ? atual.add(chave) : atual.delete(chave);
        }
      }
    });
  }

  // ─── Filtro e sanfona ──────────────────────────────────────────────────────

  setFilter(valor: string): void {
    this.filter.set(valor);
  }

  showModule(module: string): void {
    this.module.set(module);
    // Escolher um módulo no filtro é querer vê-lo aberto.
    if (module !== 'todos') this.opened.set(new Set([...this.opened(), module]));
  }

  toggleOpen(module: string): void {
    const abertos = new Set(this.opened());
    abertos.has(module) ? abertos.delete(module) : abertos.add(module);
    this.opened.set(abertos);
  }

  /** Sem `actions` (API mais velha que o site), a tela ainda aparece, com "Ver". */
  private actionsOf(screen: ScreenRow): PermissionName[] {
    const acoes = screen.actions?.length ? screen.actions : ['CONSULTAR' as PermissionName];
    return [...acoes].sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));
  }

  /**
   * Toda escrita cria um `Set` novo.
   *
   * Mutar o de dentro do sinal não dispara nada: a referência continua a mesma,
   * e a grade ficaria parada enquanto o estado muda por baixo.
   */
  private write(mudanca: (atual: Set<string>) => void): void {
    const proximo = new Set(this.working());
    mudanca(proximo);
    this.working.set(proximo);
  }
}
