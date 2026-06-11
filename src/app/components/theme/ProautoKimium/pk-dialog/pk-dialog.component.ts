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

  visibleChange = output<boolean>();

  onHide(): void {
    this.visibleChange.emit(false);
  }
}
