import { Component } from '@angular/core';
import { RevealDirective } from '../../../../../shared/directives/reveal.directive';

@Component({
  selector: 'app-about-us',
  imports: [RevealDirective],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.scss'
})
export class AboutUsComponent {
  currentYear: number = new Date().getFullYear() - 1989;

}
