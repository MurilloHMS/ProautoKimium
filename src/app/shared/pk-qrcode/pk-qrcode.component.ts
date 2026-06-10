import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-pk-qrcode',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TooltipModule,
    QRCodeComponent
  ],
  templateUrl: './pk-qrcode.component.html',
  styleUrl: './pk-qrcode.component.scss'
})
export class PkQrcodeComponent {

  @Input() url = '';
  @Input() title = 'QR Code';
  @Input() tooltip = 'QR Code';
  @Input() icon = 'pi pi-qrcode';

  visible = false;

  open(): void {
    this.visible = true;
  }
}
