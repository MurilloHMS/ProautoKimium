import { Component, input } from '@angular/core';

/**
 * Cabeçalho padrão das páginas autenticadas.
 *
 * Hoje 29 componentes repetem esse mesmo bloco na mão (`.header-icon` +
 * `.page-title` + `.page-subtitle`). Aqui ele vira um componente só, já com os
 * tokens de tema — quem precisar de botões à direita projeta com `[actions]`:
 *
 * ```html
 * <app-page-header icon="pi pi-folder-open" title="Documentos" subtitle="...">
 *   <button actions>Novo</button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  icon = input<string>('');
  title = input.required<string>();
  subtitle = input<string>('');

  /** `lg` é para telas de dashboard, que pedem um título maior que o das telas de lista. */
  size = input<'md' | 'lg'>('md');
}
