import { Component } from '@angular/core';

/**
 * Barra de ferramentas de uma tela de grade.
 *
 * Substitui o cabeçalho com título e subtítulo: a aba já diz em que tela o
 * usuário está, então repetir o nome só rouba altura da grade. No lugar entram
 * as ações, os filtros e a busca — como em ERP.
 *
 * ```html
 * <app-toolbar>
 *   <pk-button pkType="new" pkLabel="Novo" pkSize="sm" (clicked)="openForm()" />
 *   <pk-button pkType="refresh" pkLabel="Atualizar" pkSize="sm" (clicked)="reload()" />
 *
 *   <div filters>
 *     <p-select … />
 *     <input class="toolbar-search" placeholder="Buscar…"
 *            (input)="grid.filterGlobal($any($event.target).value)" />
 *   </div>
 * </app-toolbar>
 * ```
 */
@Component({
  selector: 'app-toolbar',
  standalone: true,
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {}
