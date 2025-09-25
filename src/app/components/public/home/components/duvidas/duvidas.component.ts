import { Component } from '@angular/core';
import { ContactButtonComponent } from "../../../../../shared/contact-button/contact-button.component";
import { ButtonDirective } from "primeng/button";
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-duvidas',
    imports: [ContactButtonComponent, ButtonDirective, RouterModule],
    templateUrl: './duvidas.component.html',
    styleUrl: './duvidas.component.scss'
})
export class DuvidasComponent {

}
