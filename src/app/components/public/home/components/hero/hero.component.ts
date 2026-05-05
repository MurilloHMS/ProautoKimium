import { Component } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ContactComponent } from '../../../../../shared/contact/contact.component';

@Component({
    selector: 'app-hero',
    imports: [DialogModule, ContactComponent],
    templateUrl: './hero.component.html',
    styleUrl: './hero.component.scss'
})
export class HeroComponent {
    menuAberto = false;
    visible = false;

    currentYear: number = new Date().getFullYear() - 1989;

    showContact() {
    this.visible = true;
  }
}
