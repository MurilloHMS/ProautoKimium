import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PermissionAdminService } from '../../../../infrastructure/services/permission/permission-admin.service';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import {
  PERMISSION_LABELS, PermissionName, ScreenAccessPerson, ScreenRow,
} from '../../../../domain/models/permission-admin.model';

/** A ordem de leitura das ações, a mesma da grade. */
const ORDEM: PermissionName[] = ['CONSULTAR', 'INCLUIR', 'ALTERAR', 'EXCLUIR', 'BAIXAR', 'ENVIAR', 'CONFIGURAR'];

interface ScreenItem {
  screen: ScreenRow;
  people: ScreenAccessPerson[];
}

/**
 * A aba Telas: quem acessa cada tela.
 *
 * Pedido dele em 2026-10-08 ("a tela checklist, quem tem acesso?"). A grade de
 * cada pessoa responde "o que o Ricardo pode"; esta aba responde a pergunta
 * virada de lado, sem abrir conta por conta.
 *
 * **Só mostra, não edita.** Clicar numa pessoa leva à conta dela na aba
 * Usuários, onde o acesso se muda. Duas telas editando a mesma célula seriam
 * duas barras de salvar para a mesma coisa.
 */
@Component({
  selector: 'app-admin-screens',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, PkButtonComponent, PkInputComponent, PkSheetComponent],
  templateUrl: './admin-screens.component.html',
  styleUrl: './admin-screens.component.scss',
})
export class AdminScreensComponent implements OnInit {

  private readonly api = inject(PermissionAdminService);
  private readonly toast = inject(MessageService);

  readonly counted = output<number>();
  /** Abrir a conta de alguém na aba Usuários. */
  readonly openUser = output<string>();

  readonly celular = ehCelular();
  readonly labels = PERMISSION_LABELS;

  readonly screens = signal<ScreenRow[]>([]);
  private readonly access = signal<Map<string, ScreenAccessPerson[]>>(new Map());
  readonly developers = signal(0);
  readonly loading = signal(true);

  readonly search = signal('');
  readonly selectedCode = signal<string | null>(null);
  readonly sheetOpen = signal(false);

  readonly items = computed<ScreenItem[]>(() => {
    const quem = this.access();
    return this.screens().map(screen => ({ screen, people: quem.get(screen.code) ?? [] }));
  });

  /** A lista lateral, agrupada por módulo e filtrada pela busca. */
  readonly groups = computed(() => {
    const termo = this.search().trim().toLowerCase();
    const grupos = new Map<string, ScreenItem[]>();
    for (const item of this.items()) {
      if (termo && !item.screen.label.toLowerCase().includes(termo) && !item.screen.code.includes(termo)) continue;
      const lista = grupos.get(item.screen.module) ?? [];
      lista.push(item);
      grupos.set(item.screen.module, lista);
    }
    return [...grupos.entries()].map(([module, items]) => ({ module, items }));
  });

  readonly selected = computed(() =>
    this.items().find(i => i.screen.code === this.selectedCode()) ?? null);

  /** "4 podem Ver, 3 podem Incluir": uma caixa por ação da tela. */
  readonly summary = computed(() => {
    const item = this.selected();
    if (!item) return [];
    return this.sorted(item.screen.actions).map(acao => ({
      label: PERMISSION_LABELS[acao],
      count: item.people.filter(p => p.actions.includes(acao)).length,
    }));
  });

  ngOnInit(): void {
    this.api.screens().subscribe({
      next: telas => {
        this.screens.set(telas);
        this.counted.emit(telas.length);
      },
      error: () => this.falhou('Não foi possível carregar o catálogo de telas.'),
    });
    this.api.screenAccess().subscribe({
      next: visao => {
        this.access.set(new Map(visao.screens.map(s => [s.screen, s.people])));
        this.developers.set(visao.developers);
        this.loading.set(false);
        // No computador abre a primeira com alguém dentro; no celular, nada sozinho.
        if (!this.celular() && !this.selectedCode()) {
          const primeira = visao.screens.find(s => s.people.length)?.screen ?? visao.screens[0]?.screen;
          if (primeira) this.selectedCode.set(primeira);
        }
      },
      error: () => {
        this.loading.set(false);
        this.falhou('Não foi possível ver quem acessa cada tela.');
      },
    });
  }

  select(code: string): void {
    this.selectedCode.set(code);
    if (this.celular()) this.sheetOpen.set(true);
  }

  countLabel(n: number): string {
    return n === 0 ? 'ninguém' : n === 1 ? '1 pessoa' : `${n} pessoas`;
  }

  sorted(acoes: PermissionName[]): PermissionName[] {
    return [...(acoes ?? [])].sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));
  }

  /** "Excluir" ou "Ver e Incluir", para o selo de "tirado à mão". */
  listLabels(acoes: PermissionName[]): string {
    const nomes = this.sorted(acoes).map(a => PERMISSION_LABELS[a]);
    return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  }

  private falhou(detail: string): void {
    this.toast.add({ severity: 'error', summary: 'Não deu', detail });
  }
}
