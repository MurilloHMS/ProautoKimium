import { Component, input, output } from '@angular/core';

/**
 * Modo formulário de uma tela de cadastro.
 *
 * Substitui o diálogo modal: em vez de flutuar sobre a grade, o formulário
 * ocupa a área de trabalho e a grade volta quando o usuário salva ou volta.
 * É o padrão de ERP — e resolve de raiz o conflito entre máscara modal e a
 * área de trabalho com abas, onde a máscara bloqueava a própria navegação.
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
 */
@Component({
  selector: 'app-form-screen',
  standalone: true,
  templateUrl: './form-screen.component.html',
  styleUrl: './form-screen.component.scss',
})
export class FormScreenComponent {
  title = input.required<string>();
  subtitle = input<string>('');

  back = output<void>();
}
