import { Component, computed, effect, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PkInputComponent } from '../../../../theme/ProautoKimium/pk-input/pk-input.component';

import {
  PERMISSION_LABELS, PERMISSIONS, PermissionCells, PermissionName, ScreenRow,
} from '../../../../../domain/models/permission-admin.model';

/** Uma célula desenhada. */
export interface GridCell {
  permission: PermissionName;
  key: string;
  on: boolean;
  /** Difere do que os carimbos aplicados permitem — o ponto âmbar. */
  diverges: boolean;
}

/** O que o template percorre: faixas de módulo e linhas de tela, na mesma lista. */
export type GridBlock =
  | { kind: 'module'; module: string; open: boolean; allowed: number; total: number }
  | { kind: 'screen'; screen: ScreenRow; cells: GridCell[]; full: boolean };

const key = (screen: string, permission: string) => `${screen}:${permission}`;

function keysOf(cells: PermissionCells): Set<string> {
  const chaves = new Set<string>();
  for (const [tela, permissoes] of Object.entries(cells ?? {})) {
    for (const permissao of permissoes ?? []) chaves.add(key(tela, permissao));
  }
  return chaves;
}

/**
 * A grade de 55 telas por 7 permissões — a mesma nas duas telas de configuração.
 *
 * O que ela resolve não é desenhar 385 caixinhas, é **deixá-las utilizáveis**:
 * 55 linhas de uma vez não se lê, e uma ação em massa sem alcance visível é uma
 * armadilha. Daí as três decisões que valem por todo o resto:
 *
 * 1. **Módulo colapsa e mostra o placar.** Dá para achar o bloco errado sem
 *    abri-lo.
 * 2. **O alcance de toda ação em massa é o que está VISÍVEL.** Filtrou por
 *    Estoque, o "liberar tudo" mexe no Estoque. Sem isso, um clique inocente
 *    mexe em 385 células.
 * 3. **Gravar é explícito.** Gravação automática em 385 células é o desenho que
 *    apaga acesso por engano.
 *
 * O componente **não grava**: ele mantém a edição e diz quantas células
 * mudaram. Quem chama decide o que fazer com isso — é a mesma separação que
 * fez o `pk-calendar` servir a duas telas.
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

  /** O que os carimbos permitem. Vazio na tela de modelos — lá não há carimbo. */
  readonly stamped = input<PermissionCells>({});

  /** Sem `ALTERAR`, a grade é só leitura. */
  readonly disabled = input<boolean>(false);

  /** Quantas células diferem do gravado. A barra de gravação vive disto. */
  readonly changedCount = output<number>();

  readonly permissions = PERMISSIONS;
  readonly labels = PERMISSION_LABELS;

  readonly filter = signal('');
  readonly module = signal('todos');
  readonly closed = signal<ReadonlySet<string>>(new Set());

  /**
   * A edição em andamento.
   *
   * `linkedSignal` e não `signal` + `effect`: quando o pai troca o modelo
   * selecionado, a edição precisa reiniciar sozinha. Com `effect` isso seria
   * escrita de sinal dentro de efeito para manter dois estados em sincronia —
   * o jeito mais fácil de criar um laço que ninguém enxerga.
   */
  private readonly working = linkedSignal<PermissionCells, Set<string>>({
    source: this.saved,
    computation: cells => keysOf(cells),
  });

  private readonly savedKeys = computed(() => keysOf(this.saved()));
  private readonly stampedKeys = computed(() => keysOf(this.stamped()));

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

  readonly blocks = computed<GridBlock[]>(() => {
    const ligadas = this.working();
    const carimbadas = this.stampedKeys();
    const fechados = this.closed();
    const telas = this.visible();

    const blocos: GridBlock[] = [];
    let moduloAtual: string | null = null;

    for (const screen of telas) {
      if (screen.module !== moduloAtual) {
        moduloAtual = screen.module;
        const doModulo = telas.filter(s => s.module === moduloAtual);
        const abertas = doModulo.reduce((total, s) =>
          total + PERMISSIONS.filter(p => ligadas.has(key(s.code, p))).length, 0);

        blocos.push({
          kind: 'module',
          module: moduloAtual,
          open: !fechados.has(moduloAtual),
          allowed: abertas,
          total: doModulo.length * PERMISSIONS.length,
        });
      }

      if (fechados.has(screen.module)) continue;

      const cells = PERMISSIONS.map(permission => {
        const chave = key(screen.code, permission);
        const on = ligadas.has(chave);
        return {
          permission,
          key: chave,
          on,
          // Sem carimbo nenhum não há divergência — é a tela de modelos, onde
          // a coluna do esperado não existe.
          diverges: carimbadas.size > 0 && on !== carimbadas.has(chave),
        } satisfies GridCell;
      });

      blocos.push({
        kind: 'screen',
        screen,
        cells,
        full: cells.every(c => c.on),
      });
    }

    return blocos;
  });

  constructor() {
    effect(() => this.changedCount.emit(this.changed()));
  }

  // ─── O que o pai chama ─────────────────────────────────────────────────────

  /** A grade como a API a espera: só o que está ligado. */
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

  toggleCell(chave: string): void {
    if (this.disabled()) return;
    this.write(atual => {
      atual.has(chave) ? atual.delete(chave) : atual.add(chave);
    });
  }

  /**
   * Liga ou desliga uma permissão **nas telas visíveis**.
   *
   * Visíveis, e não todas: se alguém filtrou por Estoque, o alcance é o filtro.
   * O estado de saída é "todas ligadas?" — se já estão, o clique desliga, que é
   * o que a pessoa espera de um interruptor.
   */
  toggleColumn(permission: PermissionName): void {
    if (this.disabled()) return;
    const telas = this.visible();
    const todasLigadas = telas.every(s => this.working().has(key(s.code, permission)));
    this.write(atual => {
      for (const screen of telas) {
        const chave = key(screen.code, permission);
        todasLigadas ? atual.delete(chave) : atual.add(chave);
      }
    });
  }

  toggleRow(screen: ScreenRow, ligar: boolean): void {
    if (this.disabled()) return;
    this.write(atual => {
      for (const permission of PERMISSIONS) {
        const chave = key(screen.code, permission);
        ligar ? atual.add(chave) : atual.delete(chave);
      }
    });
  }

  toggleModule(module: string, ligar: boolean): void {
    if (this.disabled()) return;
    this.write(atual => {
      for (const screen of this.visible().filter(s => s.module === module)) {
        for (const permission of PERMISSIONS) {
          const chave = key(screen.code, permission);
          ligar ? atual.add(chave) : atual.delete(chave);
        }
      }
    });
  }

  /** Liberar ou bloquear tudo — de novo, só o que está visível. */
  toggleAll(ligar: boolean): void {
    if (this.disabled()) return;
    this.write(atual => {
      for (const screen of this.visible()) {
        for (const permission of PERMISSIONS) {
          const chave = key(screen.code, permission);
          ligar ? atual.add(chave) : atual.delete(chave);
        }
      }
    });
  }

  // ─── Filtro e colapso ──────────────────────────────────────────────────────

  setFilter(valor: string): void {
    this.filter.set(valor);
  }

  setModule(module: string): void {
    this.module.set(module);
  }

  collapse(module: string): void {
    const fechados = new Set(this.closed());
    fechados.has(module) ? fechados.delete(module) : fechados.add(module);
    this.closed.set(fechados);
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
