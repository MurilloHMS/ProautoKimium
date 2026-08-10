import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { PDF_TOOLS } from '../pdf-tools.catalog';

/**
 * Hub das ferramentas de PDF.
 *
 * Cada cartão abre uma ferramenta na própria aba da área de trabalho, como no
 * pdf24: o hub é só a vitrine, o trabalho acontece na tela da ferramenta.
 */
@Component({
  selector: 'app-pdf-hub',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './pdf-hub.component.html',
  styleUrl: './pdf-hub.component.scss',
})
export class PdfHubComponent {
  readonly tools = PDF_TOOLS;
}
