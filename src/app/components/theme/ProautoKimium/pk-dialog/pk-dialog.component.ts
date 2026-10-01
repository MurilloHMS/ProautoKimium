import {Component, input, output} from '@angular/core';
import {CommonModule} from "@angular/common";
import {DialogModule} from "primeng/dialog";

@Component({
  selector: 'pk-dialog',
  imports: [
    CommonModule,
    DialogModule
  ],
  templateUrl: './pk-dialog.component.html',
  styleUrl: './pk-dialog.component.scss',
})
export class PkDialogComponent {
  header = input<string>('');
  visible = input<boolean>(false);
  width = input<string>('640px');
  /**
   * Sem o corpo padrão. Por padrão o conteúdo ganha 20/24px de margem e 16px
   * entre os blocos — antes não ganhava nada, e todo diálogo novo abria com os
   * componentes colados nas bordas e entre si (pedido dele, 2026-10-01). Use
   * `flush` só quando o conteúdo traz o próprio espaçamento: `pk-form-section`,
   * colunas lado a lado, folha com padding próprio.
   */
  flush = input<boolean>(false);

  visibleChange = output<boolean>();

  onHide(): void {
    this.visibleChange.emit(false);
  }

  onVisibleChange(value: boolean): void {
    if (!value) {
      this.visibleChange.emit(false);
    }
  }
}
