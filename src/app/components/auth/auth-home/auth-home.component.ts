import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
    selector: 'app-auth-home',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './auth-home.component.html',
    styleUrl: './auth-home.component.scss'
})
export class AuthHomeComponent {
  currentDate = new Date();
}
