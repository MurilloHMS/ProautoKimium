import { Component } from '@angular/core';
import { PkStyle, PKTitleComponent } from "../../../shared/pk-title/pk-title.component";

@Component({
  selector: 'app-institucional',
  standalone: true,
  imports: [PKTitleComponent],
  templateUrl: './institucional.component.html',
  styleUrl: './institucional.component.scss'
})
export class InstitucionalComponent {
PkStyle = PkStyle;
}
