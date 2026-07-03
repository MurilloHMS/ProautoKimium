import { Component } from '@angular/core';
import {Router} from "@angular/router";
import {PkButtonComponent} from "../../theme/ProautoKimium/pk-button/pk-button.component";

@Component({
    selector: 'app-not-found',
  imports: [
    PkButtonComponent
  ],
    templateUrl: './not-found.component.html',
    styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {

  constructor(private router: Router){}

  goBack(): void {
    history.back();
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
