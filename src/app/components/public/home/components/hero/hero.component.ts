import { Component } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ContactComponent } from '../../../../../shared/contact/contact.component';
import {RouterLink} from "@angular/router";

@Component({
    selector: 'app-hero',
  imports: [DialogModule, ContactComponent, RouterLink],
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
