import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopMenuComponent } from "../../components/auth/shared/top-menu/top-menu.component";

@Component({
    selector: 'app-auth-layout',
    imports: [RouterOutlet, TopMenuComponent],
    templateUrl: './auth-layout.component.html',
    styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {

}
