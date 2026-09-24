import { Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';

/**
 * Modo formulário de uma tela de cadastro.
 *
 * No desktop substitui o diálogo modal: em vez de flutuar sobre a grade, o
 * formulário ocupa a área de trabalho e a grade volta quando o usuário salva ou
 * volta. É o padrão de ERP — e resolve de raiz o conflito entre máscara modal e
 * a área de trabalho com abas, onde a máscara bloqueava a própria navegação.
 *
 * **No celular ele sobe de baixo**, como folha, desde 2026-09-24. A troca é
 * aqui dentro e nenhuma das 19 telas que usam este componente mudou uma linha
 * para ganhá-la: elas já entregavam título, corpo e ações, que são exatamente
 * as três partes da folha.
 *
 * ```html
 * <app-form-screen title="Nova Empresa" (back)="closeForm()">
 *   <form [formGroup]="form" class="form-grid"> … </form>
 *   <div formActions>
 *     <pk-button pkType="cancel" (clicked)="closeForm()" pkLabel="Cancelar" />
 *     <pk-button pkType="save" (clicked)="save()" pkLabel="Salvar" />
 *   </div>
 * </app-form-screen>
 * ```
 *
 * A tela dona continua decidindo **se** o formulário existe, com o `@if` dela
 * em volta deste componente. A folha não guarda esse estado de novo.
 */
@Component({
  selector: 'app-form-screen',
  standalone: true,
  imports: [NgTemplateOutlet, PkSheetComponent],
  templateUrl: './form-screen.component.html',
  styleUrl: './form-screen.component.scss',
  host: { '[class.em-folha]': 'ehCelular()' },
})
export class FormScreenComponent {
  title = input.required<string>();
  subtitle = input<string>('');

  /**
   * `wide` solta a largura do corpo para formulários grandes (funcionário,
   * perfil): com mais espaço o `.form-grid` de auto-fit passa de duas para
   * três colunas por linha e o formulário encurta bastante.
   *
   * No celular não tem efeito — a folha é sempre da largura da tela.
   */
  width = input<'default' | 'wide'>('default');

  back = output<void>();

  readonly ehCelular = ehCelular();
}
